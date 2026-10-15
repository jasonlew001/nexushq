-- Nexus HQ migration 006 — widen hq_inspo_posts.topic.
-- Hand-run in the Supabase SQL Editor after 005.
--
-- recruiting  = golf recruiting / college / junior golf
-- adjacent    = recruiting content from other sports, college-decision and
--               sports-parent content (same audience, borrowable formats)
-- general     = general golf formats from small/mid creators
-- competitor  = top posts from recruiting services and college golf coaches

alter table public.hq_inspo_posts
  drop constraint if exists hq_inspo_posts_topic_check;

alter table public.hq_inspo_posts
  add constraint hq_inspo_posts_topic_check
  check (topic in ('recruiting', 'adjacent', 'general', 'competitor'));

-- Verification — expect the 4-value check.
-- select pg_get_constraintdef(oid) from pg_constraint
-- where conname = 'hq_inspo_posts_topic_check';
