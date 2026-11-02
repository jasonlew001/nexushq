-- Sales rep RLS round-trip test (from 013). Run ON ITS OWN in the Supabase
-- SQL Editor — never in the same run as a migration: it ends in a deliberate
-- error, and the editor runs a pasted script as one transaction, so that
-- error rolls back everything above it too.
--
-- It impersonates a non-founder rep and ends with a deliberate error whose message holds the results, so
-- EVERYTHING it inserted is rolled back. Expected message:
--   a_is_rep=true | reps_visible=1 | claims_visible=1 | backdate_ignored=true
--   | reviews_visible=0 | payouts_visible=0 | cross_rep_insert=blocked (good)
-- ============================================================================
do $$
declare
  test_uid uuid;
  b_id uuid;
  r record;
  cross_result text;
begin
  -- Any non-founder account stands in for rep A's login (nothing is changed
  -- on it; its id is only used as the impersonated auth.uid()).
  select u.id into test_uid
  from auth.users u
  left join public.user_profiles p on p.id = u.id
  where not coalesce(p.is_founder, false)
  limit 1;

  insert into public.hq_sales_reps (name, email) values ('RLS test A', 'rls-a@test.invalid');
  insert into public.hq_sales_reps (name, email) values ('RLS test B', 'rls-b@test.invalid')
    returning id into b_id;
  insert into public.hq_sales_claims (rep_id, customer_email, kind, created_by)
    values (b_id, 'cust-b@test.invalid', 'individual', test_uid);

  -- Become rep A.
  perform set_config('request.jwt.claims',
    json_build_object('sub', test_uid, 'email', 'rls-a@test.invalid', 'role', 'authenticated')::text,
    true);
  set local role authenticated;

  -- Own claim, with an attempted backdate the trigger must overwrite.
  insert into public.hq_sales_claims (rep_id, customer_email, kind, created_at)
    values (public.current_sales_rep_id(), 'cust-a@test.invalid', 'individual', '2020-01-01');

  -- Claim filed under ANOTHER rep's id must be refused.
  begin
    insert into public.hq_sales_claims (rep_id, customer_email, kind)
      values (b_id, 'sneaky@test.invalid', 'individual');
    cross_result := 'ALLOWED (bad)';
  exception when others then
    cross_result := 'blocked (good)';
  end;

  select
    public.current_sales_rep_id() is not null as a_is_rep,
    (select count(*) from public.hq_sales_reps) as reps,
    (select count(*) from public.hq_sales_claims) as claims,
    (select bool_and(created_at > now() - interval '1 minute') from public.hq_sales_claims) as backdate_ignored,
    (select count(*) from public.hq_sales_claim_reviews) as reviews,
    (select count(*) from public.hq_sales_payouts) as payouts
  into r;

  raise exception 'RLS test (all rolled back): a_is_rep=% | reps_visible=% | claims_visible=% | backdate_ignored=% | reviews_visible=% | payouts_visible=% | cross_rep_insert=%',
    r.a_is_rep, r.reps, r.claims, r.backdate_ignored, r.reviews, r.payouts, cross_result;
end $$;
