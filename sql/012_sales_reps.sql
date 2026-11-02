-- Nexus HQ migration 012 — Sales rep commission tracking.
-- Hand-run in the Supabase SQL Editor after 011, then run the verification
-- queries at the bottom.
--
-- Model: a rep CLAIMS a customer by email; HQ matches that email to a main-
-- site account and confirms the first Stripe payment (individuals), or a
-- founder enters the deal amount (academies / junior tours). Month-end
-- payouts are snapshotted into hq_sales_payouts when a founder marks them
-- paid. HQ never moves money — it only records what was paid.
--
-- Four tables, split so reps can only ever write the one thing they own:
--   hq_sales_reps           founder-managed roster (+ monthly salary)
--   hq_sales_claims         rep-submitted (insert-only for reps)
--   hq_sales_claim_reviews  founder-only decisions about a claim
--   hq_sales_payouts        founder-only month-end payout snapshots
--
-- Rep identity = the verified email on their Supabase session (magic link),
-- matched against hq_sales_reps.email. Reps are not founders, so every
-- existing HQ table/policy stays closed to them.

-- ============================================================================
-- 1. Reps
-- ============================================================================
create table if not exists public.hq_sales_reps (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  email text not null unique
    check (email = lower(email) and char_length(email) between 3 and 254),
  monthly_salary_cents integer not null default 0 check (monthly_salary_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.hq_sales_reps is
  'Sales reps managed from the Nexus HQ Sales page. email must match the '
  'rep''s Supabase login email (lowercase) for the rep portal.';

alter table public.hq_sales_reps enable row level security;

drop policy if exists founders_all on public.hq_sales_reps;
create policy founders_all on public.hq_sales_reps
  for all to authenticated
  using ((select public.is_founder())) with check ((select public.is_founder()));

-- A rep can read their own roster row (needed to resolve their rep id).
drop policy if exists rep_select_own on public.hq_sales_reps;
create policy rep_select_own on public.hq_sales_reps
  for select to authenticated
  using (email = lower((select auth.jwt() ->> 'email')));

-- The calling rep's id, or null. SECURITY INVOKER: it only reads the row the
-- rep_select_own policy above already lets them see.
create or replace function public.current_sales_rep_id()
returns uuid
language sql
stable
security invoker
set search_path = public
as $$
  select id from public.hq_sales_reps
  where email = lower(auth.jwt() ->> 'email') and active
$$;

grant execute on function public.current_sales_rep_id() to authenticated;

-- ============================================================================
-- 2. Claims — "this customer is mine". Reps insert only; never update/delete.
-- ============================================================================
create table if not exists public.hq_sales_claims (
  id uuid primary key default gen_random_uuid(),
  rep_id uuid not null references public.hq_sales_reps(id) on delete restrict,
  customer_email text not null
    check (customer_email = lower(customer_email) and char_length(customer_email) between 3 and 254),
  customer_name text check (char_length(customer_name) <= 100),
  kind text not null check (kind in ('individual', 'academy', 'tour')),
  rep_note text check (char_length(rep_note) <= 500),
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users(id)
);

create index if not exists hq_sales_claims_rep_idx on public.hq_sales_claims (rep_id);
create index if not exists hq_sales_claims_email_idx on public.hq_sales_claims (customer_email);

comment on table public.hq_sales_claims is
  'Customers claimed by sales reps. created_at is the claim time used for '
  'the "claimed before payment" rule; only founders may backdate it.';

alter table public.hq_sales_claims enable row level security;

-- created_at decides commission eligibility, so a rep can't backdate a claim.
-- Founders can (e.g. entering a claim a rep texted in earlier).
create or replace function public.hq_sales_claims_stamp()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- coalesce: is_founder() is null for a user with no user_profiles row.
  if not coalesce(public.is_founder(), false) then
    new.created_at := now();
    new.created_by := auth.uid();
  end if;
  return new;
end
$$;

drop trigger if exists hq_sales_claims_stamp on public.hq_sales_claims;
create trigger hq_sales_claims_stamp
  before insert on public.hq_sales_claims
  for each row execute function public.hq_sales_claims_stamp();

drop policy if exists founders_all on public.hq_sales_claims;
create policy founders_all on public.hq_sales_claims
  for all to authenticated
  using ((select public.is_founder())) with check ((select public.is_founder()));

drop policy if exists rep_select_own on public.hq_sales_claims;
create policy rep_select_own on public.hq_sales_claims
  for select to authenticated
  using (rep_id = (select public.current_sales_rep_id()));

drop policy if exists rep_insert_own on public.hq_sales_claims;
create policy rep_insert_own on public.hq_sales_claims
  for insert to authenticated
  with check (rep_id = (select public.current_sales_rep_id()));

-- ============================================================================
-- 3. Founder review of a claim. No row = no decision yet. Founder-only.
-- ============================================================================
create table if not exists public.hq_sales_claim_reviews (
  claim_id uuid primary key references public.hq_sales_claims(id) on delete cascade,
  rejected boolean not null default false,
  -- Manual link when the customer signed up under a different email.
  linked_user_id uuid references auth.users(id) on delete set null,
  -- Academy: first payment amount (commission = 25% of it).
  payment_cents integer check (payment_cents >= 0),
  -- Tour flat rate, or a manual override of the computed commission.
  commission_cents integer check (commission_cents >= 0),
  -- Which payout month a manual (academy/tour/override) commission lands in.
  earned_on date,
  note text check (char_length(note) <= 1000),
  updated_at timestamptz not null default now(),
  updated_by uuid not null default auth.uid() references auth.users(id)
);

alter table public.hq_sales_claim_reviews enable row level security;

drop policy if exists founders_all on public.hq_sales_claim_reviews;
create policy founders_all on public.hq_sales_claim_reviews
  for all to authenticated
  using ((select public.is_founder())) with check ((select public.is_founder()));

-- ============================================================================
-- 4. Month-end payouts. One row per rep per month, written when marked paid.
-- ============================================================================
create table if not exists public.hq_sales_payouts (
  id uuid primary key default gen_random_uuid(),
  rep_id uuid not null references public.hq_sales_reps(id) on delete restrict,
  period_month date not null check (extract(day from period_month) = 1),
  salary_cents integer not null check (salary_cents >= 0),
  commission_cents integer not null check (commission_cents >= 0),
  total_cents integer not null check (total_cents = salary_cents + commission_cents),
  -- Snapshot of the claims paid, so later edits never rewrite history.
  line_items jsonb not null default '[]'::jsonb,
  payment_reference text check (char_length(payment_reference) <= 200),
  paid_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users(id),
  unique (rep_id, period_month)
);

alter table public.hq_sales_payouts enable row level security;

drop policy if exists founders_all on public.hq_sales_payouts;
create policy founders_all on public.hq_sales_payouts
  for all to authenticated
  using ((select public.is_founder())) with check ((select public.is_founder()));

drop policy if exists rep_select_own on public.hq_sales_payouts;
create policy rep_select_own on public.hq_sales_payouts
  for select to authenticated
  using (rep_id = (select public.current_sales_rep_id()));

-- ============================================================================
-- Verification — run after the above.
-- ============================================================================

-- 1. Columns.
-- select table_name, column_name, data_type, is_nullable, column_default
-- from information_schema.columns
-- where table_schema = 'public' and table_name like 'hq_sales_%'
-- order by table_name, ordinal_position;

-- 2. RLS on for all four (expect 4 rows, all true).
-- select relname, relrowsecurity from pg_class
-- where relnamespace = 'public'::regnamespace and relname like 'hq_sales_%'
--   and relkind = 'r';

-- 3. Policies (expect founders_all on 4, rep_select_own on reps/claims/payouts,
--    rep_insert_own on claims).
-- select tablename, policyname, cmd from pg_policies
-- where schemaname = 'public' and tablename like 'hq_sales_%'
-- order by tablename, policyname;

-- 4. Anon sees nothing (expect 0 rows / permission errors).
-- set role anon;
-- select count(*) from public.hq_sales_reps;
-- select count(*) from public.hq_sales_claims;
-- select count(*) from public.hq_sales_claim_reviews;
-- select count(*) from public.hq_sales_payouts;
-- reset role;
