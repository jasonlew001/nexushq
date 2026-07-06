-- Nexus HQ — manual costs table (the only table this app writes to).
-- Hand-run in the Supabase SQL Editor (shared project with fairway-mvp; no
-- migrations framework there, so we follow the same convention here).
-- Run this once, then run the verification queries at the bottom.

create table if not exists public.hq_manual_costs (
  id uuid primary key default gen_random_uuid(),
  service text not null check (char_length(service) <= 100),
  amount_cents integer not null check (amount_cents >= 0),
  cadence text not null default 'monthly'
    check (cadence in ('monthly', 'annual', 'one_time')),
  -- required iff cadence = 'one_time' (enforced below); first-of-month date
  -- this one-time cost should count toward burn.
  one_time_month date,
  notes text check (char_length(notes) <= 500),
  is_active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint one_time_month_required_for_one_time check (
    (cadence <> 'one_time') or (one_time_month is not null)
  )
);

comment on table public.hq_manual_costs is
  'Founder-entered recurring/one-time costs (Vercel, Supabase, domains, etc.) '
  'for the Nexus HQ costs panel. Not fed by any external billing API — always '
  'labeled "manual" in the UI, never blended with the live Anthropic figure.';

-- Keep updated_at honest on every write.
create or replace function public.hq_manual_costs_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists hq_manual_costs_touch_updated_at on public.hq_manual_costs;
create trigger hq_manual_costs_touch_updated_at
  before update on public.hq_manual_costs
  for each row
  execute function public.hq_manual_costs_set_updated_at();

-- RLS enabled at creation, no exceptions (house rule). Founder-only for
-- every operation via the existing public.is_founder() (SECURITY DEFINER,
-- already granted to `authenticated` in add-attribution-columns.sql) — the
-- DB enforces the same gate the app does; no service role in the write path.
alter table public.hq_manual_costs enable row level security;

drop policy if exists founders_select on public.hq_manual_costs;
create policy founders_select on public.hq_manual_costs
  for select to authenticated
  using (public.is_founder());

drop policy if exists founders_insert on public.hq_manual_costs;
create policy founders_insert on public.hq_manual_costs
  for insert to authenticated
  with check (public.is_founder());

drop policy if exists founders_update on public.hq_manual_costs;
create policy founders_update on public.hq_manual_costs
  for update to authenticated
  using (public.is_founder())
  with check (public.is_founder());

drop policy if exists founders_delete on public.hq_manual_costs;
create policy founders_delete on public.hq_manual_costs
  for delete to authenticated
  using (public.is_founder());

-- ============================================================================
-- Verification queries — run after the above, confirm output before building
-- against this table.
-- ============================================================================

-- 1. Columns match what the app expects.
-- select column_name, data_type, is_nullable, column_default
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'hq_manual_costs'
-- order by ordinal_position;

-- 2. RLS is enabled.
-- select relrowsecurity from pg_class where oid = 'public.hq_manual_costs'::regclass;
-- -- expect: t

-- 3. Exactly 4 policies, all gated on is_founder().
-- select polname, polcmd, pg_get_expr(polqual, polrelid) as using_expr,
--        pg_get_expr(polwithcheck, polrelid) as check_expr
-- from pg_policy
-- where polrelid = 'public.hq_manual_costs'::regclass;

-- 4. is_founder() exists and is SECURITY DEFINER (confirms Part A's function
--    is present in this Supabase project before HQ depends on it).
-- select proname, prosecdef
-- from pg_proc
-- where proname = 'is_founder' and pronamespace = 'public'::regnamespace;
-- -- expect: prosecdef = true
