-- Nexus HQ migration 004 — Requests inbox (contact form submissions).
-- Hand-run in the Supabase SQL Editor (same convention as 001-003), then run
-- the verification queries at the bottom.
--
-- contact_submissions is a product table owned by the main app (written by
-- fairway-mvp's /api/contact with the service role). HQ stays read-only
-- toward it: this migration only ADDS a founder SELECT policy there. Triage
-- state lives in HQ's own table below, keyed by submission id.

-- ============================================================================
-- 1. Founders can read every contact submission.
-- ============================================================================
drop policy if exists founders_select on public.contact_submissions;
create policy founders_select on public.contact_submissions
  for select to authenticated
  using (public.is_founder());

-- ============================================================================
-- 2. Triage state per submission. No row = "new" (so every existing and
--    future submission shows up as new without a backfill).
-- ============================================================================
create table if not exists public.hq_request_triage (
  submission_id uuid primary key
    references public.contact_submissions(id) on delete cascade,
  status text not null default 'new'
    check (status in ('new', 'in_progress', 'resolved')),
  note text check (char_length(note) <= 1000),
  updated_at timestamptz not null default now(),
  updated_by uuid not null default auth.uid() references auth.users(id)
);

comment on table public.hq_request_triage is
  'Founder triage state (status + private note) for contact_submissions rows, '
  'managed from the Nexus HQ Requests page. Missing row means "new".';

alter table public.hq_request_triage enable row level security;

drop policy if exists founders_select on public.hq_request_triage;
create policy founders_select on public.hq_request_triage
  for select to authenticated using (public.is_founder());

drop policy if exists founders_insert on public.hq_request_triage;
create policy founders_insert on public.hq_request_triage
  for insert to authenticated with check (public.is_founder());

drop policy if exists founders_update on public.hq_request_triage;
create policy founders_update on public.hq_request_triage
  for update to authenticated
  using (public.is_founder()) with check (public.is_founder());

drop policy if exists founders_delete on public.hq_request_triage;
create policy founders_delete on public.hq_request_triage
  for delete to authenticated using (public.is_founder());

-- ============================================================================
-- Verification — run after the above.
-- ============================================================================

-- 1. contact_submissions columns match what HQ reads.
-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'contact_submissions'
-- order by ordinal_position;
-- -- expect: id, name, email, subject, message, contact_email, created_at

-- 2. contact_submissions policies: the original insert policy + founders_select.
-- select polname, polcmd, polroles::regrole[], pg_get_expr(polqual, polrelid)
-- from pg_policy where polrelid = 'public.contact_submissions'::regclass;

-- 3. Triage table columns, RLS on, 4 founder policies.
-- select column_name, data_type, is_nullable, column_default
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'hq_request_triage'
-- order by ordinal_position;
-- select relrowsecurity from pg_class where oid = 'public.hq_request_triage'::regclass;
-- select polname, polcmd from pg_policy
-- where polrelid = 'public.hq_request_triage'::regclass;

-- 4. Anon sees nothing (run with role anon; expect 0 rows / permission error).
-- set role anon;
-- select count(*) from public.contact_submissions;
-- select count(*) from public.hq_request_triage;
-- reset role;
