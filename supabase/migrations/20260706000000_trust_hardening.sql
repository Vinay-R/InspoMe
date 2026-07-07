-- Trust hardening (2026-07-06)
-- 1. connected_accounts: token columns unreadable via anon/authenticated (RLS clients)
-- 2. event_log: drop the anonymous-insert arm; authenticated own-row inserts only
-- 3. inspo: unique (user_id, url_canonical) partial index to dedupe re-saves
-- 4. Composite (inspo_id, user_id) FKs so denormalized user_id can never drift
-- 5. Drop redundant partial index inspo_user_hidden_idx
-- 6. pg_cron reaper for ingestion jobs / analytics syncs stuck in-flight >15 min
-- 7. Public-read `thumbnails` storage bucket (writes via service role only)

-- ────────────────────────────────────────────────────────────────────
-- 1. connected_accounts — OAuth token columns must never reach the browser
--
-- Postgres quirk: `revoke select (col) ...` is a no-op while the role still
-- holds a table-level SELECT grant (Supabase grants those by default). So we
-- revoke the table-level SELECT and re-grant an explicit safe column list to
-- `authenticated` (RLS still scopes rows to the owner). `anon` gets nothing —
-- RLS already blocked it, this makes the grant layer agree.
-- The service-role client bypasses these grants entirely, so backend reads
-- (sync, OAuth callback) keep full access, tokens included.
-- NB: columns added to this table later must be granted here too before an
-- RLS-client select can read them — safe by default.
-- ────────────────────────────────────────────────────────────────────
revoke select on public.connected_accounts from anon, authenticated;

grant select (
  id,
  user_id,
  platform,
  platform_user_id,
  username,
  display_name,
  avatar_url,
  token_expires_at,
  scopes,
  connection_status,
  is_mock,
  last_synced_at,
  last_sync_error,
  created_at,
  updated_at
) on public.connected_accounts to authenticated;

-- ────────────────────────────────────────────────────────────────────
-- 2. event_log — kill the anonymous-insert arm
--
-- The old policy allowed `user_id is null` inserts, i.e. anyone with the anon
-- key could spam the table. Authenticated users may only log as themselves.
-- ────────────────────────────────────────────────────────────────────
drop policy if exists event_log_insert_own on public.event_log;
create policy event_log_insert_own on public.event_log
  for insert to authenticated
  with check (auth.uid() = user_id);

revoke insert on public.event_log from anon;

-- ────────────────────────────────────────────────────────────────────
-- 3. Duplicate-save dedup — one visible inspo per (user, canonical URL)
--
-- Partial: NULL canonical URLs (unparseable links) and hidden rows don't
-- count, so "hide then re-save" keeps working.
-- Pre-existing duplicates would make the CREATE fail, so first hide all but
-- the newest visible copy of each (user, url) pair. Hidden rows keep their
-- analysis and can be restored later; nothing is deleted.
-- ────────────────────────────────────────────────────────────────────
with ranked as (
  select id,
         row_number() over (
           partition by user_id, url_canonical
           order by created_at desc, id desc
         ) as rn
    from public.inspo
   where url_canonical is not null and user_hidden = false
)
update public.inspo i
   set user_hidden = true
  from ranked r
 where i.id = r.id
   and r.rn > 1;

create unique index if not exists inspo_user_url_uniq
  on public.inspo (user_id, url_canonical)
  where url_canonical is not null and user_hidden = false;

-- ────────────────────────────────────────────────────────────────────
-- 4. Composite FK integrity — child rows can't claim someone else's inspo
--
-- Each child table denormalizes user_id next to inspo_id (for RLS). A plain
-- FK on inspo_id alone lets a buggy write pair inspo A with user B; the
-- composite FK makes that unrepresentable.
-- ────────────────────────────────────────────────────────────────────
do $$ begin
  alter table public.inspo
    add constraint inspo_id_user_id_uniq unique (id, user_id);
exception
  when duplicate_object or duplicate_table then null;
end $$;

do $$ begin
  alter table public.ingestion_jobs
    add constraint ingestion_jobs_inspo_user_fkey
    foreign key (inspo_id, user_id)
    references public.inspo (id, user_id) on delete cascade;
exception
  when duplicate_object or duplicate_table then null;
end $$;

do $$ begin
  alter table public.video_analysis
    add constraint video_analysis_inspo_user_fkey
    foreign key (inspo_id, user_id)
    references public.inspo (id, user_id) on delete cascade;
exception
  when duplicate_object or duplicate_table then null;
end $$;

do $$ begin
  alter table public.platform_metrics
    add constraint platform_metrics_inspo_user_fkey
    foreign key (inspo_id, user_id)
    references public.inspo (id, user_id) on delete cascade;
exception
  when duplicate_object or duplicate_table then null;
end $$;

-- ────────────────────────────────────────────────────────────────────
-- 5. Drop redundant index — partial index on bare user_id is subsumed by
-- inspo_user_created_idx (user_id, created_at desc).
-- ────────────────────────────────────────────────────────────────────
drop index if exists public.inspo_user_hidden_idx;

-- ────────────────────────────────────────────────────────────────────
-- 6. pg_cron stale-job reaper
--
-- `waitUntil` work can die mid-flight (cold start, crash, deploy). Rows then
-- sit in an in-flight status forever and the UI spins. Every 10 minutes,
-- fail anything in-flight for >15 minutes with an honest, retryable error.
--
-- ingestion_job_status terminal set:      complete | partial | failed
-- ingestion_job_status in-flight set:     queued | downloading | downloaded
--                                         | uploading_to_gemini | analyzing
-- inspo.analysis_status in-flight set:    queued | processing
-- inspo.media_status in-flight set:       queued  (downloaded is a success state)
-- connected_accounts in-flight status:    syncing
-- ────────────────────────────────────────────────────────────────────
create extension if not exists pg_cron;

-- Unschedule first so re-running this migration doesn't error.
select cron.unschedule('reap_stale_ingestion_jobs')
 where exists (select 1 from cron.job where jobname = 'reap_stale_ingestion_jobs');

select cron.schedule(
  'reap_stale_ingestion_jobs',
  '*/10 * * * *',
  $reaper$
    with reaped as (
      update public.ingestion_jobs
         set status = 'failed',
             error_code = 'timed_out',
             error_message = 'The analysis timed out. Tap retry to run it again.',
             completed_at = now()
       where status in ('queued', 'downloading', 'downloaded', 'uploading_to_gemini', 'analyzing')
         and coalesce(started_at, created_at) < now() - interval '15 minutes'
      returning inspo_id
    )
    update public.inspo i
       set analysis_status = 'failed',
           media_status = case
             when i.media_status = 'queued' then 'failed'::media_status
             else i.media_status
           end
     where i.id in (select inspo_id from reaped)
       and i.analysis_status in ('queued', 'processing');

    update public.connected_accounts
       set connection_status = 'connected',
           last_sync_error = 'Sync timed out. Try again.'
     where connection_status = 'syncing'
       and updated_at < now() - interval '15 minutes';
  $reaper$
);

-- ────────────────────────────────────────────────────────────────────
-- 7. thumbnails storage bucket — public read, service-role-only writes
--
-- No INSERT/UPDATE/DELETE policies on purpose: the service role bypasses RLS,
-- and end users must never write here directly.
-- ────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('thumbnails', 'thumbnails', true)
on conflict (id) do nothing;

drop policy if exists thumbnails_public_read on storage.objects;
create policy thumbnails_public_read on storage.objects
  for select to public
  using (bucket_id = 'thumbnails');
