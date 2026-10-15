-- Nexus HQ migration 005 — Inspiration library (viral golf reels/slideshows).
-- Hand-run in the Supabase SQL Editor (same convention as 001-004), then run
-- the verification queries at the bottom.
--
-- Posts are written ONLY by scripts/import-inspiration.mjs (service role,
-- fed by Monid scraper runs). Founders read them, can hide junk, and own the
-- favorites / boards / notes layered on top.

-- ============================================================================
-- 1. Scraped posts. One row per (platform, external_id); re-imports upsert
--    the stats in place. Stats are NULL when the platform doesn't expose them
--    (e.g. Instagram carousels have no public view count) — never 0.
-- ============================================================================
create table if not exists public.hq_inspo_posts (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('tiktok', 'instagram')),
  format text not null check (format in ('video', 'slideshow', 'reel', 'carousel', 'image')),
  external_id text not null,
  url text not null,
  creator_username text,
  creator_name text,
  creator_followers bigint,
  creator_verified boolean,
  caption text,
  hashtags text[] not null default '{}',
  views bigint,
  likes bigint,
  comments bigint,
  shares bigint,
  saves bigint,
  duration_seconds numeric,
  slide_count integer,
  sound text,
  thumbnail_url text,
  posted_at timestamptz,
  topic text not null default 'general' check (topic in ('recruiting', 'general')),
  source_query text,
  hidden boolean not null default false,
  -- Views per follower. Floor of 100 followers so a 3-follower account with
  -- 2k views doesn't top the chart at 666x. NULL when either side is unknown.
  outlier_score numeric generated always as (
    case when views is null or creator_followers is null then null
         else round(views::numeric / greatest(creator_followers, 100), 2) end
  ) stored,
  -- (likes + comments + shares + saves) / views, missing parts count as 0.
  engagement_rate numeric generated always as (
    case when views is null or views = 0 then null
         else round((coalesce(likes, 0) + coalesce(comments, 0) + coalesce(shares, 0)
                     + coalesce(saves, 0))::numeric / views, 4) end
  ) stored,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (platform, external_id)
);

comment on table public.hq_inspo_posts is
  'Viral golf TikToks/Reels/slideshows scraped via Monid for marketing '
  'inspiration. Written only by scripts/import-inspiration.mjs (service role); '
  'founders may only flip `hidden`.';

create index if not exists hq_inspo_posts_views_idx on public.hq_inspo_posts (views desc nulls last);
create index if not exists hq_inspo_posts_outlier_idx on public.hq_inspo_posts (outlier_score desc nulls last);
create index if not exists hq_inspo_posts_hashtags_idx on public.hq_inspo_posts using gin (hashtags);

alter table public.hq_inspo_posts enable row level security;

drop policy if exists founders_select on public.hq_inspo_posts;
create policy founders_select on public.hq_inspo_posts
  for select to authenticated using (public.is_founder());

-- Founders can hide/unhide junk (e.g. VW Golf car clips) but never edit
-- scraped data: table-level UPDATE is revoked and re-granted on `hidden` only.
drop policy if exists founders_update on public.hq_inspo_posts;
create policy founders_update on public.hq_inspo_posts
  for update to authenticated
  using (public.is_founder()) with check (public.is_founder());

revoke insert, update, delete on public.hq_inspo_posts from anon, authenticated;
grant update (hidden) on public.hq_inspo_posts to authenticated;

-- ============================================================================
-- 2. Favorites — per founder. Everyone sees who starred what; you can only
--    add/remove your own star.
-- ============================================================================
create table if not exists public.hq_inspo_favorites (
  post_id uuid not null references public.hq_inspo_posts(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.hq_inspo_favorites enable row level security;

drop policy if exists founders_select on public.hq_inspo_favorites;
create policy founders_select on public.hq_inspo_favorites
  for select to authenticated using (public.is_founder());

drop policy if exists founders_insert_own on public.hq_inspo_favorites;
create policy founders_insert_own on public.hq_inspo_favorites
  for insert to authenticated
  with check (public.is_founder() and user_id = auth.uid());

drop policy if exists founders_delete_own on public.hq_inspo_favorites;
create policy founders_delete_own on public.hq_inspo_favorites
  for delete to authenticated
  using (public.is_founder() and user_id = auth.uid());

-- ============================================================================
-- 3. Boards — shared, founder-named folders ("Hook ideas", "Slideshow
--    formats"). A post can sit on any number of boards.
-- ============================================================================
create table if not exists public.hq_inspo_boards (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(trim(name)) between 1 and 60),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.hq_inspo_boards enable row level security;

drop policy if exists founders_select on public.hq_inspo_boards;
create policy founders_select on public.hq_inspo_boards
  for select to authenticated using (public.is_founder());

drop policy if exists founders_insert on public.hq_inspo_boards;
create policy founders_insert on public.hq_inspo_boards
  for insert to authenticated with check (public.is_founder());

drop policy if exists founders_update on public.hq_inspo_boards;
create policy founders_update on public.hq_inspo_boards
  for update to authenticated
  using (public.is_founder()) with check (public.is_founder());

drop policy if exists founders_delete on public.hq_inspo_boards;
create policy founders_delete on public.hq_inspo_boards
  for delete to authenticated using (public.is_founder());

create table if not exists public.hq_inspo_board_posts (
  board_id uuid not null references public.hq_inspo_boards(id) on delete cascade,
  post_id uuid not null references public.hq_inspo_posts(id) on delete cascade,
  added_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (board_id, post_id)
);

create index if not exists hq_inspo_board_posts_post_idx on public.hq_inspo_board_posts (post_id);

alter table public.hq_inspo_board_posts enable row level security;

drop policy if exists founders_select on public.hq_inspo_board_posts;
create policy founders_select on public.hq_inspo_board_posts
  for select to authenticated using (public.is_founder());

drop policy if exists founders_insert on public.hq_inspo_board_posts;
create policy founders_insert on public.hq_inspo_board_posts
  for insert to authenticated with check (public.is_founder());

drop policy if exists founders_delete on public.hq_inspo_board_posts;
create policy founders_delete on public.hq_inspo_board_posts
  for delete to authenticated using (public.is_founder());

-- ============================================================================
-- 4. Notes — shared thread per post, attributed. Anyone can read; you can
--    only post as yourself and delete your own.
-- ============================================================================
create table if not exists public.hq_inspo_notes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.hq_inspo_posts(id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users(id),
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists hq_inspo_notes_post_idx on public.hq_inspo_notes (post_id, created_at);

alter table public.hq_inspo_notes enable row level security;

drop policy if exists founders_select on public.hq_inspo_notes;
create policy founders_select on public.hq_inspo_notes
  for select to authenticated using (public.is_founder());

drop policy if exists founders_insert_own on public.hq_inspo_notes;
create policy founders_insert_own on public.hq_inspo_notes
  for insert to authenticated
  with check (public.is_founder() and author_id = auth.uid());

drop policy if exists founders_delete_own on public.hq_inspo_notes;
create policy founders_delete_own on public.hq_inspo_notes
  for delete to authenticated
  using (public.is_founder() and author_id = auth.uid());

-- ============================================================================
-- Verification — run after the above.
-- ============================================================================

-- 1. Columns (expect generated outlier_score + engagement_rate on posts).
-- select table_name, column_name, data_type, is_nullable, is_generated
-- from information_schema.columns
-- where table_schema = 'public' and table_name like 'hq_inspo_%'
-- order by table_name, ordinal_position;

-- 2. RLS on for all five tables (expect 5 rows, all t).
-- select relname, relrowsecurity from pg_class
-- where relname like 'hq_inspo_%' and relkind = 'r';

-- 3. Policies.
-- select c.relname, p.polname, p.polcmd
-- from pg_policy p join pg_class c on c.oid = p.polrelid
-- where c.relname like 'hq_inspo_%' order by 1, 2;

-- 4. authenticated can update only `hidden` on posts (expect one row: hidden).
-- select column_name from information_schema.column_privileges
-- where table_schema = 'public' and table_name = 'hq_inspo_posts'
--   and grantee = 'authenticated' and privilege_type = 'UPDATE';

-- 5. Anon sees nothing (expect 0 / permission error on each).
-- set role anon;
-- select count(*) from public.hq_inspo_posts;
-- select count(*) from public.hq_inspo_notes;
-- reset role;
