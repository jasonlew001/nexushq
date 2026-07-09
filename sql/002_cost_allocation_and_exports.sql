-- Nexus HQ migration 002 — cost allocation + customer-export tracking.
-- Hand-run in the Supabase SQL Editor (same convention as 001), then run
-- the verification queries at the bottom.

-- ============================================================================
-- 1. Who pays each manual cost. Multi-person: combos split evenly in the
--    app. Empty array = unassigned (legacy rows default to it).
-- ============================================================================
alter table public.hq_manual_costs
  add column if not exists paid_by text[] not null default '{}';

alter table public.hq_manual_costs
  drop constraint if exists paid_by_known_people;
alter table public.hq_manual_costs
  add constraint paid_by_known_people
  check (paid_by <@ array['nick', 'jason', 'kamp']::text[]);

-- ============================================================================
-- 2. Export tracking — which auth users have been included in a customer
--    CSV export (so future exports can show only never-exported people).
--    One row per user; re-exporting bumps exported_at.
-- ============================================================================
create table if not exists public.hq_customer_exports (
  user_id uuid primary key references auth.users(id) on delete cascade,
  exported_at timestamptz not null default now(),
  exported_by uuid not null default auth.uid() references auth.users(id)
);

alter table public.hq_customer_exports enable row level security;

drop policy if exists founders_select on public.hq_customer_exports;
create policy founders_select on public.hq_customer_exports
  for select to authenticated using (public.is_founder());

drop policy if exists founders_insert on public.hq_customer_exports;
create policy founders_insert on public.hq_customer_exports
  for insert to authenticated with check (public.is_founder());

drop policy if exists founders_update on public.hq_customer_exports;
create policy founders_update on public.hq_customer_exports
  for update to authenticated
  using (public.is_founder()) with check (public.is_founder());

drop policy if exists founders_delete on public.hq_customer_exports;
create policy founders_delete on public.hq_customer_exports
  for delete to authenticated using (public.is_founder());

-- ============================================================================
-- Verification — run after the above.
-- ============================================================================

-- 1. paid_by column exists with the right default.
-- select column_name, data_type, column_default
-- from information_schema.columns
-- where table_name = 'hq_manual_costs' and column_name = 'paid_by';

-- 2. Constraint accepts only known names.
-- select conname, pg_get_constraintdef(oid)
-- from pg_constraint where conname = 'paid_by_known_people';

-- 3. Export table columns.
-- select column_name, data_type, is_nullable, column_default
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'hq_customer_exports'
-- order by ordinal_position;

-- 4. RLS on + 4 founder policies.
-- select relrowsecurity from pg_class where oid = 'public.hq_customer_exports'::regclass;
-- select polname, polcmd from pg_policy
-- where polrelid = 'public.hq_customer_exports'::regclass;
