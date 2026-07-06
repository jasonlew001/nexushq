# Nexus HQ — Handoff from the main Nexus repo (fairway-mvp)

Written 2026-07-06. Context doc for building Nexus HQ (the founder dashboard, Part B) in a
new standalone repo. Everything below was verified against `fairway-mvp` code/SQL at the
time of writing — re-verify schema with `information_schema.columns` queries before building,
per house rules.

## What the main app is
- Product: Nexus Golf Recruiting (nexusgolfrecruiting.com). Repo `fairway-mvp`, npm package
  `nexus-app`. Next.js 14.2 App Router + TypeScript, Supabase (auth + Postgres via
  `@supabase/ssr` 0.8), Stripe hosted Checkout, deployed on Vercel.
- Nexus HQ shares the SAME Supabase project (same auth users, same tables). It must be
  read-only toward product tables.

## Part A (attribution) — what exists
Migration: `scripts/add-attribution-columns.sql` in the main repo (hand-run in the Supabase
SQL Editor; there is no migrations framework). Confirm it has been run — sanity queries are
at the bottom of that file. As of handoff, the Part A code changes were still uncommitted in
the main repo's working tree.

New columns on `public.user_profiles` (all nullable TEXT unless noted):
- Survey ("how did you hear about us", collected ONLY on the post-payment success card, so
  it exists only for paying customers): `acq_source`, `acq_source_detail` (both ≤100 chars).
  Allowed `acq_source` values: `coach_referral | instagram | google_search | friend_teammate
  | tournament | other` (enforced server-side in `src/lib/attribution.ts`; `acq_source_detail`
  is free text from the "other" option).
- First-touch UTM/referrer (captured by middleware into a 90-day `nx_attr` cookie, written
  at signup / auth callback, first touch wins): `utm_source`, `utm_medium`, `utm_campaign`
  (≤100), `first_referrer`, `landing_page` (≤200).
- `is_founder BOOLEAN NOT NULL DEFAULT false` — set manually in the SQL Editor.

Key semantics for the dashboard:
- All attribution values are untrusted user input: length-capped, stored as plain text,
  NEVER rendered as HTML. Escape on render in HQ too.
- Pre-tracking users (everyone who signed up before 2026-07-05) have NULL in every
  attribution column. Expected — show "no attribution data", not broken charts.
- Hear-about-us ≠ UTM: survey data exists only for payers; UTM exists for any signup that
  came through the tracked funnel.

## Founder access (already built — reuse, don't reinvent)
- `public.is_founder()` — SECURITY DEFINER SQL function, returns the calling user's
  `is_founder` flag, granted to `authenticated`. Callable from HQ as an RPC:
  `supabase.rpc('is_founder')`.
- RLS policy `founders_read_all` on `user_profiles`: founders can SELECT every profile row
  with a normal authenticated session — HQ does NOT need the service-role key just to read
  profiles. (Service role is still needed for anything RLS blocks or for `auth.users` email
  lookups via the admin API.)
- Founder flag is protected by the `prevent_subscription_self_update` trigger (below), so a
  browser session can't self-promote.

## user_profiles — columns HQ cares about
- Identity: `id UUID` (FK → `auth.users.id`; emails live in `auth.users`, not this table),
  `first_name`, `last_name`, `city_state TEXT` (free-text "City, ST" — parse the state out
  of it for the signups-by-state chart; expect messy/NULL values), `phone`,
  `graduation_year INTEGER`, `gender`, `updated_at`.
  Note: there is no dedicated `created_at`/state column verified — check
  `information_schema.columns` for the signup-date source (`created_at` on `auth.users` is
  the reliable signup timestamp).
- Stripe/subscription (from `scripts/add-stripe-columns.sql`): `stripe_customer_id`,
  `stripe_subscription_id`, `subscription_status` ('active' | 'canceled' | 'past_due' |
  'trialing' | null), `subscription_renews_at TIMESTAMPTZ`, `subscription_tier`.
- IMPORTANT tier model: `subscription_tier` is only `'free' | 'premium'`. "Tiers" in the
  product are really billing intervals — three Stripe prices: monthly / 6-month / annual
  (env: `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_6MO`, `STRIPE_PRICE_ANNUAL`; live IDs are in
  Vercel env, `.env.local` has TEST-mode prices). The interval is NOT stored in the DB — to
  break "paying subscribers by tier"/MRR by plan, read the subscription's price from Stripe
  server-side (the fallback path the Part B prompt already allows).

## Server-managed columns trigger (why HQ must never write product tables anyway)
`prevent_subscription_self_update` (latest version lives in
`scripts/add-attribution-columns.sql`) blocks `authenticated`/`anon` roles from writing any
Stripe, subscription, attribution, or `is_founder` column. Only the Stripe webhook and
attribution API routes (service role) and the SQL Editor (`postgres`) write them. HQ is
read-only, so this never fires for it — but it means the DB values are trustworthy.

## Stripe state in the DB (prefer this over live API calls)
Webhook (`src/app/api/stripe/webhook/route.ts` in the main repo) keeps `user_profiles` in
sync: checkout completed → tier `premium` + status; subscription updated → `premium`/`free`
by active-ness; deleted → `free`/`canceled`; invoice payment failed → `past_due`. So
status/tier/renewal date can come straight from the DB. Use server-side Stripe reads for:
plan interval (tier breakdown), MRR by plan, lifetime revenue, and per-customer payment
history. `stripe_customer_id` is indexed.

## Other tables that exist (context, mostly not needed by HQ)
`schools`, `coaches`, `roster_players`, `tournaments`, `tournament_details`, `jgs_rankings`
(public-read product data), `saved_schools`, `saved_tournaments`, `contact_submissions`,
`launch_signups` (pre-launch email list — possibly useful as a funnel number, verify it's
still written to).

## Anthropic
- The main site's AI recommendations call Claude (Haiku 4.5) — KNOWN BUG in the main repo:
  that key currently ships to the browser as `NEXT_PUBLIC_CLAUDE_API_KEY`. It is slated for
  rotation. The HQ Admin API key must be a SEPARATE key (console.anthropic.com → Settings →
  Admin keys), server-side env only, used exclusively for the Usage & Cost reporting
  endpoints — never for model calls.
- Cost attribution note: because the main-site key is exposed client-side today, historical
  usage numbers could include abuse traffic; treat anomalies pre-rotation with suspicion.

## Env vars HQ needs (values from Jason / Vercel — never NEXT_PUBLIC_ for secrets)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (same Supabase project as the
  main app), `SUPABASE_SERVICE_ROLE_KEY` (server-only, only where RLS/auth-admin requires).
- `STRIPE_SECRET_KEY` (read-only usage; mind TEST vs LIVE mode — main repo's `.env.local`
  is TEST, Vercel is LIVE. HQ should point at LIVE).
- `ANTHROPIC_ADMIN_KEY` (new, separate, server-only).

## Gotchas
- Local dev ports 3000/3001 are usually occupied on Jason's machine; main app dev runs on
  3002. Pick a free port for HQ.
- Do not blend TEST-mode and LIVE-mode Stripe data.
- Two founder accounts total; non-founders get a 404 on every HQ route (no redirect hints).
- House rules apply in the new repo too: RLS on any new table (e.g. the manual costs table)
  at creation, every schema change as a committed .sql file, verify writes with SQL,
  smallest-diff style, no new deps without asking.
