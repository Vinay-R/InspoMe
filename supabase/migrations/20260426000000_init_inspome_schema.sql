-- InspoMe initial schema
-- See: inspome_v3_inspo_page_mvp_spec_with_onboarding.md
-- Tables: users (profile), inspo, ingestion_jobs, video_analysis, platform_metrics, event_log
-- All user-owned tables enforce RLS with auth.uid() = user_id

-- ────────────────────────────────────────────────────────────────────
-- Extensions
-- ────────────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ────────────────────────────────────────────────────────────────────
-- Enums
-- ────────────────────────────────────────────────────────────────────
do $$ begin
  create type platform as enum ('tiktok', 'instagram', 'unknown');
exception when duplicate_object then null; end $$;

do $$ begin
  create type analysis_status as enum (
    'not_started', 'queued', 'processing', 'complete', 'partial', 'failed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type media_status as enum ('not_started', 'queued', 'downloaded', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type metrics_status as enum (
    'not_started', 'available', 'partial', 'unavailable', 'failed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type access_status as enum ('unknown', 'accessible', 'limited', 'unavailable');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ingestion_job_status as enum (
    'queued', 'downloading', 'downloaded', 'uploading_to_gemini',
    'analyzing', 'complete', 'partial', 'failed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type creator_category as enum (
    'business_brand', 'creator_personal_brand', 'artist_musician', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type experience_level as enum ('beginner', 'intermediate', 'advanced');
exception when duplicate_object then null; end $$;

do $$ begin
  create type metrics_source as enum (
    'official_api', 'permissioned_user_connection', 'research_api',
    'embed_metadata', 'manual', 'unavailable'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type confidence_level as enum ('high', 'medium', 'low', 'unknown');
exception when duplicate_object then null; end $$;

-- ────────────────────────────────────────────────────────────────────
-- Generic updated_at trigger
-- ────────────────────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ────────────────────────────────────────────────────────────────────
-- users — profile data tied to auth.users (one-to-one)
-- ────────────────────────────────────────────────────────────────────
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  creator_category creator_category,
  creator_category_custom text,
  niche text[] not null default '{}',
  content_goals text[] not null default '{}',
  preferred_content text[] not null default '{}',
  pillars text[] not null default '{}',
  tone text[] not null default '{}',
  experience_level experience_level,
  onboarding_completed boolean not null default false,
  onboarding_completed_at timestamptz,
  timezone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
before update on public.users
for each row execute function set_updated_at();

-- Auto-create profile row on auth signup so the app never sees missing profile.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- ────────────────────────────────────────────────────────────────────
-- inspo — the saved link, single source of truth for the user's library
-- ────────────────────────────────────────────────────────────────────
create table if not exists public.inspo (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  url_original text not null,
  url_canonical text,
  platform platform not null default 'unknown',
  platform_content_id text,
  creator_handle text,
  caption text,
  thumbnail_url text,
  deep_link_url text not null,
  media_storage_url text,
  duration_seconds numeric,
  save_reasons text[] not null default '{}',
  note text,
  access_status access_status not null default 'unknown',
  media_status media_status not null default 'not_started',
  analysis_status analysis_status not null default 'not_started',
  metrics_status metrics_status not null default 'not_started',
  user_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_analyzed_at timestamptz,
  last_metrics_fetched_at timestamptz
);

drop trigger if exists inspo_set_updated_at on public.inspo;
create trigger inspo_set_updated_at
before update on public.inspo
for each row execute function set_updated_at();

create index if not exists inspo_user_created_idx on public.inspo (user_id, created_at desc);
create index if not exists inspo_user_hidden_idx on public.inspo (user_id) where user_hidden = false;
create index if not exists inspo_platform_idx on public.inspo (user_id, platform);
create index if not exists inspo_analysis_status_idx on public.inspo (user_id, analysis_status);

-- ────────────────────────────────────────────────────────────────────
-- ingestion_jobs — one row per (re)ingestion attempt
-- ────────────────────────────────────────────────────────────────────
create table if not exists public.ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  inspo_id uuid not null references public.inspo(id) on delete cascade,
  provider text not null default 'cobalt',
  status ingestion_job_status not null default 'queued',
  attempts int not null default 0,
  error_code text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists ingestion_jobs_inspo_idx on public.ingestion_jobs (inspo_id, created_at desc);
create index if not exists ingestion_jobs_status_idx on public.ingestion_jobs (status, created_at);

-- ────────────────────────────────────────────────────────────────────
-- video_analysis — Gemini structured output, one row per analysis run
-- ────────────────────────────────────────────────────────────────────
create table if not exists public.video_analysis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  inspo_id uuid not null references public.inspo(id) on delete cascade,
  summary text not null default '',
  content_category text,
  primary_topic text,
  target_audience text,
  why_it_worked jsonb not null default '{}'::jsonb,
  hook jsonb not null default '{}'::jsonb,
  structure jsonb not null default '{}'::jsonb,
  visuals jsonb not null default '{}'::jsonb,
  audio jsonb not null default '{}'::jsonb,
  editing jsonb not null default '{}'::jsonb,
  reusable_pattern jsonb not null default '{}'::jsonb,
  tags jsonb not null default '{}'::jsonb,
  search_summary text not null default '',
  model_provider text not null default 'gemini',
  model_name text not null default 'unknown',
  prompt_version text not null default 'v0',
  schema_version text not null default 'v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists video_analysis_set_updated_at on public.video_analysis;
create trigger video_analysis_set_updated_at
before update on public.video_analysis
for each row execute function set_updated_at();

create unique index if not exists video_analysis_inspo_unique on public.video_analysis (inspo_id);
create index if not exists video_analysis_user_idx on public.video_analysis (user_id);
create index if not exists video_analysis_search_idx on public.video_analysis using gin (to_tsvector('english', search_summary));

-- ────────────────────────────────────────────────────────────────────
-- platform_metrics — historical metrics snapshots
-- ────────────────────────────────────────────────────────────────────
create table if not exists public.platform_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  inspo_id uuid not null references public.inspo(id) on delete cascade,
  platform platform not null,
  views numeric,
  likes numeric,
  comments numeric,
  shares numeric,
  saves numeric,
  favorites numeric,
  reposts numeric,
  creator_follower_count numeric,
  posted_at timestamptz,
  engagement_rate numeric,
  like_rate numeric,
  comment_rate numeric,
  share_rate numeric,
  save_rate numeric,
  source metrics_source not null default 'unavailable',
  confidence confidence_level not null default 'unknown',
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists platform_metrics_inspo_idx on public.platform_metrics (inspo_id, fetched_at desc);

-- ────────────────────────────────────────────────────────────────────
-- event_log — analytics fallback when PostHog is not wired
-- ────────────────────────────────────────────────────────────────────
create table if not exists public.event_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_name text not null,
  entity_type text,
  entity_id uuid,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists event_log_user_idx on public.event_log (user_id, created_at desc);
create index if not exists event_log_name_idx on public.event_log (event_name, created_at desc);

-- ────────────────────────────────────────────────────────────────────
-- Row-Level Security
-- ────────────────────────────────────────────────────────────────────
alter table public.users enable row level security;
alter table public.inspo enable row level security;
alter table public.ingestion_jobs enable row level security;
alter table public.video_analysis enable row level security;
alter table public.platform_metrics enable row level security;
alter table public.event_log enable row level security;

-- users
drop policy if exists users_select_own on public.users;
create policy users_select_own on public.users
  for select using (auth.uid() = id);

drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- inspo
drop policy if exists inspo_select_own on public.inspo;
create policy inspo_select_own on public.inspo
  for select using (auth.uid() = user_id);

drop policy if exists inspo_insert_own on public.inspo;
create policy inspo_insert_own on public.inspo
  for insert with check (auth.uid() = user_id);

drop policy if exists inspo_update_own on public.inspo;
create policy inspo_update_own on public.inspo
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists inspo_delete_own on public.inspo;
create policy inspo_delete_own on public.inspo
  for delete using (auth.uid() = user_id);

-- ingestion_jobs (reads only via session; writes only via service role)
drop policy if exists ingestion_jobs_select_own on public.ingestion_jobs;
create policy ingestion_jobs_select_own on public.ingestion_jobs
  for select using (auth.uid() = user_id);

-- video_analysis (reads only via session; writes only via service role)
drop policy if exists video_analysis_select_own on public.video_analysis;
create policy video_analysis_select_own on public.video_analysis
  for select using (auth.uid() = user_id);

-- platform_metrics (reads only via session; writes only via service role)
drop policy if exists platform_metrics_select_own on public.platform_metrics;
create policy platform_metrics_select_own on public.platform_metrics
  for select using (auth.uid() = user_id);

-- event_log: writes via session (own user_id), reads via service role only
drop policy if exists event_log_insert_own on public.event_log;
create policy event_log_insert_own on public.event_log
  for insert with check (auth.uid() = user_id or user_id is null);
