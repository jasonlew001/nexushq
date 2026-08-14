-- Nexus HQ migration 003 — Instagram Graph API integration.
-- Hand-run in the Supabase SQL Editor (same convention as 001/002), then run
-- the verification queries at the bottom.

-- ============================================================================
-- 1. OAuth token storage. One row per connected Instagram account (in
--    practice, exactly one: nexusgolfrecruiting). Holds a live bearer
--    token, which is more sensitive than anything else HQ stores — unlike
--    every other table in this app, it has ZERO policies for `authenticated`
--    (not even founders_select). RLS is enabled with an empty policy set,
--    which denies every operation to every non-service-role caller by
--    default. All reads/writes go through getAdminClient() (service role,
--    which bypasses RLS by design) from server-only code: the OAuth
--    callback route and the daily cron route. Nothing about this table is
--    ever exposed to a founder's browser session, intentionally — there's
--    no product reason a session needs the raw token, only what it lets us
--    fetch (see hq_instagram_snapshots below and the live API calls it
--    powers).
-- ============================================================================
create table if not exists public.hq_instagram_tokens (
  id uuid primary key default gen_random_uuid(),
  ig_user_id text not null unique,
  access_token text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.hq_instagram_tokens is
  'Long-lived Instagram Graph API access token for the connected business '
  'account. Service-role write/read only — RLS enabled with no policies for '
  '`authenticated`, so no founder session (even is_founder()) can touch this '
  'table directly. See src/lib/instagram.ts getValidAccessToken().';

create or replace function public.hq_instagram_tokens_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists hq_instagram_tokens_touch_updated_at on public.hq_instagram_tokens;
create trigger hq_instagram_tokens_touch_updated_at
  before update on public.hq_instagram_tokens
  for each row
  execute function public.hq_instagram_tokens_set_updated_at();

alter table public.hq_instagram_tokens enable row level security;
-- Deliberately no policies created here — see table comment above.

-- ============================================================================
-- 2. Daily follower/engagement snapshots. Instagram's API only exposes
--    CURRENT stats, no historical time series — this table is what makes a
--    followers-over-time chart possible at all, one row per day, written by
--    the daily cron (src/app/api/cron/instagram-sync/route.ts). Not
--    sensitive (just counts), so founders can read it normally; still no
--    authenticated insert/update/delete — writes only via the cron route's
--    service-role client.
-- ============================================================================
create table if not exists public.hq_instagram_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null unique,
  follower_count integer,
  media_count integer,
  avg_likes numeric,
  avg_comments numeric,
  created_at timestamptz not null default now()
);

comment on table public.hq_instagram_snapshots is
  'One row per day: follower/media counts + average recent-post engagement, '
  'written by the daily Instagram sync cron. Powers the followers-over-time '
  'chart on /social — there is no way to backfill history before this table '
  'existed, so the chart starts sparse by design.';

alter table public.hq_instagram_snapshots enable row level security;

drop policy if exists founders_select on public.hq_instagram_snapshots;
create policy founders_select on public.hq_instagram_snapshots
  for select to authenticated
  using (public.is_founder());

-- ============================================================================
-- Verification queries — run after the above, confirm output before building
-- against these tables.
-- ============================================================================

-- 1. Both tables' columns match what the app expects.
-- select table_name, column_name, data_type, is_nullable, column_default
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name in ('hq_instagram_tokens', 'hq_instagram_snapshots')
-- order by table_name, ordinal_position;

-- 2. RLS is enabled on both.
-- select relname, relrowsecurity from pg_class
-- where oid in ('public.hq_instagram_tokens'::regclass, 'public.hq_instagram_snapshots'::regclass);
-- -- expect: t, t

-- 3. hq_instagram_tokens has ZERO policies (deliberate — service-role only).
-- select polname, polcmd from pg_policy
-- where polrelid = 'public.hq_instagram_tokens'::regclass;
-- -- expect: no rows

-- 4. hq_instagram_snapshots has exactly 1 policy (founders_select), gated on is_founder().
-- select polname, polcmd, pg_get_expr(polqual, polrelid) as using_expr
-- from pg_policy
-- where polrelid = 'public.hq_instagram_snapshots'::regclass;
