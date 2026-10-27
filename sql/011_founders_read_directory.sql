-- Nexus HQ migration 011 — founders can read the main site's directory tables.
-- Hand-run in the Supabase SQL Editor after 010.
--
-- fairway-mvp 651fcf3 (scripts/lock-directory-tables-server-only.sql) dropped
-- the public_read policies on these tables so the anon key can't bulk-download
-- them; `coaches` lost its public_read earlier (remove-coaches-public-read.sql).
-- HQ's Data health page (src/lib/data/freshness.ts) reads them with the
-- founder session, so RLS now hands it zero rows and every dataset shows
-- "never". This adds a SELECT policy for founders only — anon and ordinary
-- signed-in users stay locked out, same as after the lock script.
--
-- RLS is already enabled on all six tables; this only adds a policy.
-- `(select public.is_founder())` is evaluated once per query, not per row
-- (jgs_rankings is ~77k rows).

drop policy if exists founders_read on public.schools;
create policy founders_read on public.schools
  for select to authenticated
  using ((select public.is_founder()));

drop policy if exists founders_read on public.coaches;
create policy founders_read on public.coaches
  for select to authenticated
  using ((select public.is_founder()));

drop policy if exists founders_read on public.roster_players;
create policy founders_read on public.roster_players
  for select to authenticated
  using ((select public.is_founder()));

drop policy if exists founders_read on public.jgs_rankings;
create policy founders_read on public.jgs_rankings
  for select to authenticated
  using ((select public.is_founder()));

drop policy if exists founders_read on public.tournaments;
create policy founders_read on public.tournaments
  for select to authenticated
  using ((select public.is_founder()));

drop policy if exists founders_read on public.tournament_details;
create policy founders_read on public.tournament_details
  for select to authenticated
  using ((select public.is_founder()));

-- Verify: one founders_read row per table, and RLS still on.
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in ('schools', 'coaches', 'roster_players', 'jgs_rankings',
                    'tournaments', 'tournament_details')
order by tablename, policyname;

select relname as table_name, relrowsecurity as rls_enabled
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('schools', 'coaches', 'roster_players', 'jgs_rankings',
                  'tournaments', 'tournament_details')
order by relname;
