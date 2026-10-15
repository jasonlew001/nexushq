-- Nexus HQ migration 007 — save/share rate sorts for the inspiration library.
-- Hand-run in the Supabase SQL Editor after 006.
--
-- For marketing a paid product, saves ("this is reference material") and
-- shares ("sending this to my kid / teammate") are better signals than raw
-- views. Generated so the page can ORDER BY them server-side.

alter table public.hq_inspo_posts
  add column if not exists save_rate numeric generated always as (
    case when views is null or views = 0 or saves is null then null
         else round(saves::numeric / views, 4) end
  ) stored;

alter table public.hq_inspo_posts
  add column if not exists share_rate numeric generated always as (
    case when views is null or views = 0 or shares is null then null
         else round(shares::numeric / views, 4) end
  ) stored;

-- Verification — expect both columns, is_generated = ALWAYS.
-- select column_name, data_type, is_generated
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'hq_inspo_posts'
--   and column_name in ('save_rate', 'share_rate');
