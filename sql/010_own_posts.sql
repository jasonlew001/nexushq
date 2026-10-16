-- Nexus HQ migration 010 — track our own Instagram + TikTok posts.
-- Hand-run in the Supabase SQL Editor after 009.
--
-- Written by the daily cron (src/app/api/cron/instagram-sync/route.ts) with
-- the service role: Instagram from the Graph API, TikTok from a Monid
-- scrape of @nexusgolfrecruiting. Founders read everything and may only
-- correct a post's `theme` (the sync never overwrites a theme a founder set).

-- ============================================================================
-- 1. One row per post we published, with its latest stats.
-- ============================================================================
create table if not exists public.hq_own_posts (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('tiktok', 'instagram')),
  external_id text not null,
  url text not null,
  caption text,
  format text not null check (format in ('video', 'slideshow', 'reel', 'carousel', 'image')),
  posted_at timestamptz not null,
  theme text,
  theme_set_by_founder boolean not null default false,
  views bigint,
  likes bigint,
  comments bigint,
  shares bigint,
  saves bigint,
  reach bigint, -- Instagram only
  save_rate numeric generated always as (
    case when views is null or views = 0 or saves is null then null
         else round(saves::numeric / views, 4) end
  ) stored,
  share_rate numeric generated always as (
    case when views is null or views = 0 or shares is null then null
         else round(shares::numeric / views, 4) end
  ) stored,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (platform, external_id)
);

comment on table public.hq_own_posts is
  'Our own Instagram/TikTok posts with latest stats, written by the daily '
  'sync (service role). Founders may only edit theme / theme_set_by_founder.';

alter table public.hq_own_posts enable row level security;

drop policy if exists founders_select on public.hq_own_posts;
create policy founders_select on public.hq_own_posts
  for select to authenticated using (public.is_founder());

drop policy if exists founders_update on public.hq_own_posts;
create policy founders_update on public.hq_own_posts
  for update to authenticated
  using (public.is_founder()) with check (public.is_founder());

revoke insert, update, delete on public.hq_own_posts from anon, authenticated;
grant update (theme, theme_set_by_founder) on public.hq_own_posts to authenticated;

-- ============================================================================
-- 2. Daily stat snapshots, so posts compare at the same age (e.g. day 7)
--    instead of a 3-month-old post beating yesterday's on raw totals.
-- ============================================================================
create table if not exists public.hq_own_post_snapshots (
  post_id uuid not null references public.hq_own_posts(id) on delete cascade,
  captured_on date not null,
  age_days integer not null,
  views bigint,
  likes bigint,
  comments bigint,
  shares bigint,
  saves bigint,
  reach bigint,
  primary key (post_id, captured_on)
);

alter table public.hq_own_post_snapshots enable row level security;

drop policy if exists founders_select on public.hq_own_post_snapshots;
create policy founders_select on public.hq_own_post_snapshots
  for select to authenticated using (public.is_founder());
-- No authenticated writes: service role only.

-- ============================================================================
-- 3. Small key/value state for multi-day sync work. Holds the pending Monid
--    TikTok run id (each daily run collects yesterday's scrape and starts the
--    next, since a scrape outlasts a cron invocation). Service role only.
-- ============================================================================
create table if not exists public.hq_sync_state (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.hq_sync_state enable row level security;
-- Deliberately no policies: service role only (same pattern as hq_instagram_tokens).

-- ============================================================================
-- Verification — run after the above.
-- ============================================================================

-- 1. Columns.
-- select table_name, column_name, data_type, is_nullable, is_generated
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name in ('hq_own_posts', 'hq_own_post_snapshots', 'hq_sync_state')
-- order by table_name, ordinal_position;

-- 2. RLS on for all three (expect t, t, t).
-- select relname, relrowsecurity from pg_class
-- where relname in ('hq_own_posts', 'hq_own_post_snapshots', 'hq_sync_state');

-- 3. authenticated may update only theme columns on hq_own_posts.
-- select column_name from information_schema.column_privileges
-- where table_schema = 'public' and table_name = 'hq_own_posts'
--   and grantee = 'authenticated' and privilege_type = 'UPDATE';
