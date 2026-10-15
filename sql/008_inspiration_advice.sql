-- Nexus HQ migration 008 — flag advice/tips content in the inspiration library.
-- Hand-run in the Supabase SQL Editor after 007.
--
-- Set by scripts/import-inspiration.mjs from caption + hashtags + the search
-- that found the post (TikTok slideshow text lives in the images, which the
-- scraper can't read). Powers the "Tips & Advice" tab: copy-ready advice
-- slideshows/carousels to remake with a Nexus hook on the last slide.

alter table public.hq_inspo_posts
  add column if not exists is_advice boolean not null default false;

create index if not exists hq_inspo_posts_advice_idx
  on public.hq_inspo_posts (is_advice) where is_advice;

-- Verification — expect one boolean column, default false.
-- select column_name, data_type, is_nullable, column_default
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'hq_inspo_posts'
--   and column_name = 'is_advice';
