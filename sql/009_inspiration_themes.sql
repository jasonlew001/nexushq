-- Nexus HQ migration 009 — theme + personal flag for inspiration insights.
-- Hand-run in the Supabase SQL Editor after 008.
--
-- Both are set by scripts/import-inspiration.mjs from caption + hashtags +
-- search term (rule-based, see THEMES / PERSONAL_RE there):
--   theme        what the post teaches or covers ("putting", "contacting-coaches"…)
--   is_personal  works because of who posted it (POV, day-in-my-life,
--                "I committed!") — excluded from "what can we copy" insights
-- Re-running the import re-tags every post, so refining the rules is free.

alter table public.hq_inspo_posts
  add column if not exists theme text,
  add column if not exists is_personal boolean not null default false;

create index if not exists hq_inspo_posts_theme_idx on public.hq_inspo_posts (theme);

-- Verification — expect theme (text, nullable) and is_personal (boolean, default false).
-- select column_name, data_type, is_nullable, column_default
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'hq_inspo_posts'
--   and column_name in ('theme', 'is_personal');
