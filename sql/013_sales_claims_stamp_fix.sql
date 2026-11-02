-- Nexus HQ migration 013 — fix the claim-stamp trigger from 012.
-- Hand-run in the Supabase SQL Editor after 012. The rep RLS test that used
-- to sit below this lives in sql/tests/sales_rep_rls_test.sql — run it
-- separately: its deliberate final error rolled this fix back when both
-- ran together (the editor runs one pasted script as one transaction).
--
-- Bug: 012's trigger stamped created_by := auth.uid() for every non-founder
-- caller, including session-less ones (SQL Editor / service role), where
-- auth.uid() is null -> NOT NULL violation on any claim inserted there. The
-- stamp exists to stop REPS backdating, so it now applies only to callers
-- with a session who aren't founders. Anon can't insert at all (RLS).

create or replace function public.hq_sales_claims_stamp()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- coalesce: is_founder() is null for a user with no user_profiles row.
  if auth.uid() is not null and not coalesce(public.is_founder(), false) then
    new.created_at := now();
    new.created_by := auth.uid();
  end if;
  return new;
end
$$;

