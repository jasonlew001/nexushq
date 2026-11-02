-- Nexus HQ migration 014 — reps can log a customer without knowing the
-- email they'll sign up with. Hand-run in the Supabase SQL Editor after 013,
-- BEFORE deploying the code that reads customer_phone.
--
-- customer_email becomes optional; a claim needs an email OR a name. An
-- optional phone helps HQ suggest which main-site account a name-only claim
-- belongs to (user_profiles.phone). A founder confirms the match by linking
-- it (hq_sales_claim_reviews.linked_user_id, unchanged).

alter table public.hq_sales_claims
  alter column customer_email drop not null;

alter table public.hq_sales_claims
  add column if not exists customer_phone text
    check (char_length(customer_phone) <= 30);

alter table public.hq_sales_claims
  drop constraint if exists hq_sales_claims_email_or_name;
alter table public.hq_sales_claims
  add constraint hq_sales_claims_email_or_name
    check (customer_email is not null or char_length(trim(customer_name)) >= 2);

-- Verification (run separately, after the above):
-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'hq_sales_claims'
-- order by ordinal_position;
-- -- expect customer_email is_nullable = YES, and a customer_phone text column
--
-- select conname, pg_get_constraintdef(oid) from pg_constraint
-- where conrelid = 'public.hq_sales_claims'::regclass and contype = 'c';
-- -- expect hq_sales_claims_email_or_name among them
