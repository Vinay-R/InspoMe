-- InspoMe analytics schema
-- Adds 4 tables that back the /analytics page:
--   connected_accounts, creator_posts, post_metric_snapshots, analytics_insights
-- All user-owned tables enforce RLS with auth.uid() = user_id.
-- Tokens are nullable until OAuth wiring lands; mock-mode providers populate
-- the rest. Virality score column is intentionally absent until the formula is
-- finalized — it will be added additively in a follow-up migration.

-- ────────────────────────────────────────────────────────────────────
-- Enums
-- ────────────────────────────────────────────────────────────────────
do $$ begin
  create type connection_status as enum (
    'connected', 'needs_reauth', 'syncing', 'disconnected'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type creator_post_media_type as enum ('video', 'image', 'carousel');
exception when duplicate_object then null; end $$;

-- ────────────────────────────────────────────────────────────────────
-- connected_accounts — one row per (user, platform)
-- ────────────────────────────────────────────────────────────────────
create table if not exists public.connected_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform platform not null,
  platform_user_id text,
  username text,
  display_name text,
  avatar_url text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  connection_status connection_status not null default 'connected',
  is_mock boolean not null default false,
  last_synced_at timestamptz,
  last_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform)
);

drop trigger if exists connected_accounts_set_updated_at on public.connected_accounts;
create trigger connected_accounts_set_updated_at
before update on public.connected_accounts
for each row execute function set_updated_at();

create index if not exists connected_accounts_user_idx
  on public.connected_accounts (user_id);

-- ────────────────────────────────────────────────────────────────────
-- creator_posts — published posts pulled from a connected account
-- ────────────────────────────────────────────────────────────────────
create table if not exists public.creator_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connected_account_id uuid not null references public.connected_accounts(id) on delete cascade,
  platform platform not null,
  platform_post_id text not null,
  url text,
  thumbnail_url text,
  caption text,
  media_type creator_post_media_type not null default 'video',
  posted_at timestamptz,
  duration_seconds numeric,
  format_tag text,
  pillar_tag text,
  topic_tags text[] not null default '{}',
  hook_strength numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connected_account_id, platform_post_id)
);

drop trigger if exists creator_posts_set_updated_at on public.creator_posts;
create trigger creator_posts_set_updated_at
before update on public.creator_posts
for each row execute function set_updated_at();

create index if not exists creator_posts_user_posted_idx
  on public.creator_posts (user_id, posted_at desc);
create index if not exists creator_posts_account_idx
  on public.creator_posts (connected_account_id, posted_at desc);

-- ────────────────────────────────────────────────────────────────────
-- post_metric_snapshots — historical metrics, latest row is "current"
-- ────────────────────────────────────────────────────────────────────
create table if not exists public.post_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  creator_post_id uuid not null references public.creator_posts(id) on delete cascade,
  captured_at timestamptz not null default now(),
  views numeric,
  reach numeric,
  impressions numeric,
  likes numeric,
  comments numeric,
  shares numeric,
  saves numeric,
  follows numeric,
  profile_visits numeric,
  average_watch_time numeric,
  completion_rate numeric,
  engagement_rate numeric,
  share_rate numeric,
  save_rate numeric,
  raw_metrics jsonb not null default '{}'::jsonb,
  source metrics_source not null default 'unavailable',
  confidence confidence_level not null default 'unknown',
  created_at timestamptz not null default now()
);

create index if not exists post_metric_snapshots_post_idx
  on public.post_metric_snapshots (creator_post_id, captured_at desc);
create index if not exists post_metric_snapshots_user_captured_idx
  on public.post_metric_snapshots (user_id, captured_at desc);

-- ────────────────────────────────────────────────────────────────────
-- analytics_insights — heuristic-generated "What this means" cards
-- ────────────────────────────────────────────────────────────────────
create table if not exists public.analytics_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  insight_type text not null,
  title text not null,
  observation text not null,
  explanation text not null,
  recommended_action text,
  confidence confidence_level not null default 'medium',
  related_post_ids uuid[] not null default '{}',
  time_window_days int not null default 30,
  generated_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists analytics_insights_user_generated_idx
  on public.analytics_insights (user_id, generated_at desc);
create index if not exists analytics_insights_user_window_idx
  on public.analytics_insights (user_id, time_window_days, generated_at desc);

-- ────────────────────────────────────────────────────────────────────
-- Row-Level Security
-- ────────────────────────────────────────────────────────────────────
alter table public.connected_accounts    enable row level security;
alter table public.creator_posts         enable row level security;
alter table public.post_metric_snapshots enable row level security;
alter table public.analytics_insights    enable row level security;

-- connected_accounts (read own; writes via service role)
drop policy if exists connected_accounts_select_own on public.connected_accounts;
create policy connected_accounts_select_own on public.connected_accounts
  for select using (auth.uid() = user_id);

-- creator_posts (read own)
drop policy if exists creator_posts_select_own on public.creator_posts;
create policy creator_posts_select_own on public.creator_posts
  for select using (auth.uid() = user_id);

-- post_metric_snapshots (read own)
drop policy if exists post_metric_snapshots_select_own on public.post_metric_snapshots;
create policy post_metric_snapshots_select_own on public.post_metric_snapshots
  for select using (auth.uid() = user_id);

-- analytics_insights (read own)
drop policy if exists analytics_insights_select_own on public.analytics_insights;
create policy analytics_insights_select_own on public.analytics_insights
  for select using (auth.uid() = user_id);
