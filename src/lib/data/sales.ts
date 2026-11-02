import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, getAdminClient } from "@/lib/supabase-server";
import { getStripe } from "@/lib/stripe";
import { getAllAuthUsers } from "@/lib/data/users";
import {
  REP_ACADEMY_CUT,
  REP_CLAIM_GRACE_DAYS,
  REP_PLAN_COMMISSION_CENTS,
  type RepPlan,
  type SalesClaimKind,
} from "@/lib/constants";

if (typeof window !== "undefined") {
  throw new Error("sales.ts must never be imported client-side");
}

export interface SalesRep {
  id: string;
  name: string;
  email: string;
  monthlySalaryCents: number;
  active: boolean;
  createdAt: string;
}

export type ClaimStatus =
  | "rejected"
  | "conflict" // an earlier claim (any rep) owns this customer
  | "waiting_signup" // no main-site account with this email yet
  | "not_paid" // account exists, no paid invoice yet
  | "paid_before_claim" // first payment predates the claim (beyond grace)
  | "plan_unknown" // paid, but the plan couldn't be read — needs an amount
  | "needs_amount" // academy / tour: founder hasn't entered the deal yet
  | "confirmed";

export interface SalesClaim {
  id: string;
  repId: string;
  repName: string;
  customerEmail: string;
  customerName: string | null;
  kind: SalesClaimKind;
  repNote: string | null;
  claimedAt: string;
  // Resolved main-site account (by email, or a founder's manual link).
  matchedUserId: string | null;
  matchedEmail: string | null;
  linkedManually: boolean;
  firstPaidAt: string | null;
  firstPaidCents: number | null;
  plan: RepPlan | null;
  status: ClaimStatus;
  commissionCents: number; // 0 unless confirmed
  earnedMonth: string | null; // "YYYY-MM" payout month, confirmed only
  conflictWithRep: string | null;
  review: {
    rejected: boolean;
    paymentCents: number | null;
    commissionCents: number | null;
    earnedOn: string | null;
    note: string | null;
  } | null;
}

export interface SalesPayout {
  id: string;
  repId: string;
  periodMonth: string; // "YYYY-MM"
  salaryCents: number;
  commissionCents: number;
  totalCents: number;
  lineItems: PayoutLine[];
  paymentReference: string | null;
  paidAt: string;
}

export interface PayoutLine {
  claimId: string;
  customerEmail: string;
  kind: SalesClaimKind;
  commissionCents: number;
}

export interface SalesData {
  available: boolean; // false until sql/012 has been run
  reps: SalesRep[];
  claims: SalesClaim[];
  payouts: SalesPayout[];
}

interface RepRow {
  id: string;
  name: string;
  email: string;
  monthly_salary_cents: number;
  active: boolean;
  created_at: string;
}

interface ClaimRow {
  id: string;
  rep_id: string;
  customer_email: string;
  customer_name: string | null;
  kind: SalesClaimKind;
  rep_note: string | null;
  created_at: string;
}

interface ReviewRow {
  claim_id: string;
  rejected: boolean;
  linked_user_id: string | null;
  payment_cents: number | null;
  commission_cents: number | null;
  earned_on: string | null;
  note: string | null;
  updated_at: string;
}

interface PayoutRow {
  id: string;
  rep_id: string;
  period_month: string;
  salary_cents: number;
  commission_cents: number;
  total_cents: number;
  line_items: PayoutLine[];
  payment_reference: string | null;
  paid_at: string;
}

interface FirstPayment {
  paidAt: number; // unix seconds
  amountCents: number;
  plan: RepPlan | null;
}

function monthOf(isoOrDate: string): string {
  return isoOrDate.slice(0, 7);
}

function planFromInterval(interval: string, count: number): RepPlan | null {
  if (interval === "month" && count === 1) return "monthly";
  if (interval === "month" && count === 6) return "six_month";
  if (interval === "year" && count === 1) return "annual";
  return null;
}

// The customer's earliest non-zero paid invoice, plus the plan of their
// earliest subscription (= what they bought first). $0 invoices — trials,
// 100%-off coach comps — are not a sale.
async function fetchFirstPayment(customerId: string): Promise<FirstPayment | null> {
  const stripe = getStripe();
  const [invoices, subs] = await Promise.all([
    stripe.invoices.list({ customer: customerId, status: "paid", limit: 100 }),
    stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 100,
      expand: ["data.items.data.price"],
    }),
  ]);

  let first: { created: number; amount: number } | null = null;
  for (const inv of invoices.data) {
    if (inv.amount_paid <= 0) continue;
    if (!first || inv.created < first.created) first = { created: inv.created, amount: inv.amount_paid };
  }
  if (!first) return null;

  const earliestSub = [...subs.data].sort((a, b) => a.created - b.created)[0];
  const recurring = earliestSub?.items.data[0]?.price?.recurring;

  return {
    paidAt: first.created,
    amountCents: first.amount,
    plan: recurring ? planFromInterval(recurring.interval, recurring.interval_count) : null,
  };
}

const PROFILE_PAGE_SIZE = 1000;

// user id -> Stripe customer id, for every profile that has one.
async function fetchCustomerIds(supabase: SupabaseClient): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("id, stripe_customer_id")
      .not("stripe_customer_id", "is", null)
      .range(from, from + PROFILE_PAGE_SIZE - 1);
    if (error) throw new Error(`Failed to load user_profiles: ${error.message}`);
    for (const row of (data ?? []) as { id: string; stripe_customer_id: string }[]) {
      out.set(row.id, row.stripe_customer_id);
    }
    if (!data || data.length < PROFILE_PAGE_SIZE) break;
    from += PROFILE_PAGE_SIZE;
  }
  return out;
}

// The whole sales picture: reps, claims, reviews and payouts joined with
// auth.users emails and user_profiles' Stripe customer ids, then one pair of
// Stripe calls per matched individual claim. Claim counts are small
// (one-month rep test), so this is computed live per request rather than
// cached — a founder marking a payout paid must see exactly what gets
// snapshotted.
async function loadSalesData(supabase: SupabaseClient): Promise<SalesData> {
  const [reps, claims, reviews, payouts] = await Promise.all([
    supabase
      .from("hq_sales_reps")
      .select("id, name, email, monthly_salary_cents, active, created_at")
      .order("created_at"),
    supabase
      .from("hq_sales_claims")
      .select("id, rep_id, customer_email, customer_name, kind, rep_note, created_at")
      .order("created_at"),
    supabase
      .from("hq_sales_claim_reviews")
      .select("claim_id, rejected, linked_user_id, payment_cents, commission_cents, earned_on, note, updated_at"),
    supabase
      .from("hq_sales_payouts")
      .select(
        "id, rep_id, period_month, salary_cents, commission_cents, total_cents, line_items, payment_reference, paid_at"
      ),
  ]);

  // Degrade gracefully before sql/012 is run — the page shows setup copy.
  if (reps.error) return { available: false, reps: [], claims: [], payouts: [] };
  for (const r of [claims, reviews, payouts]) {
    if (r.error) throw new Error(`Failed to load sales data: ${r.error.message}`);
  }

  const repRows = (reps.data ?? []) as unknown as RepRow[];
  const claimRows = (claims.data ?? []) as unknown as ClaimRow[];
  const reviewRows = (reviews.data ?? []) as unknown as ReviewRow[];
  const payoutRows = (payouts.data ?? []) as unknown as PayoutRow[];

  const [{ data: authUsers }, customerIdByUser] = await Promise.all([
    getAllAuthUsers(),
    fetchCustomerIds(supabase),
  ]);
  const userByEmail = new Map(
    authUsers.filter((u) => u.email).map((u) => [u.email!.toLowerCase(), u])
  );
  const emailById = new Map(authUsers.map((u) => [u.id, u.email]));
  const repById = new Map(repRows.map((r) => [r.id, r]));
  const reviewByClaim = new Map(reviewRows.map((r) => [r.claim_id, r]));

  // Resolve each claim to an account first, so conflicts can be keyed by the
  // account (two different emails a founder linked to one user still clash).
  const resolved = claimRows.map((c) => {
    const review = reviewByClaim.get(c.id) ?? null;
    const userId = review?.linked_user_id ?? userByEmail.get(c.customer_email)?.id ?? null;
    return { c, review, userId };
  });

  // First non-rejected claim per customer wins; claims are ordered by
  // created_at, so the first seen is the earliest.
  const ownerByKey = new Map<string, ClaimRow>();
  for (const { c, review, userId } of resolved) {
    if (review?.rejected) continue;
    const key = userId ?? `email:${c.customer_email}`;
    if (!ownerByKey.has(key)) ownerByKey.set(key, c);
  }

  // Stripe lookups only for individual claims that own their customer.
  const customerIds = new Set<string>();
  for (const { c, review, userId } of resolved) {
    if (c.kind !== "individual" || review?.rejected || !userId) continue;
    const cid = customerIdByUser.get(userId);
    if (cid) customerIds.add(cid);
  }
  const firstPaymentByCustomer = new Map<string, FirstPayment | null>();
  await Promise.all(
    Array.from(customerIds).map(async (cid) => {
      firstPaymentByCustomer.set(cid, await fetchFirstPayment(cid));
    })
  );

  const graceMs = REP_CLAIM_GRACE_DAYS * 24 * 60 * 60 * 1000;

  const out: SalesClaim[] = resolved.map(({ c, review, userId }) => {
    const key = userId ?? `email:${c.customer_email}`;
    const owner = ownerByKey.get(key);
    const cid = userId ? customerIdByUser.get(userId) ?? null : null;
    const first = cid ? firstPaymentByCustomer.get(cid) ?? null : null;
    const manualCommission = review?.commission_cents ?? null;
    const manualMonth = review ? monthOf(review.earned_on ?? review.updated_at) : null;

    let status: ClaimStatus;
    let commissionCents = 0;
    let earnedMonth: string | null = null;

    if (review?.rejected) {
      status = "rejected";
    } else if (owner && owner.id !== c.id) {
      status = "conflict";
    } else if (manualCommission != null) {
      // A founder-entered amount always wins (tour flat rate, or override).
      status = "confirmed";
      commissionCents = manualCommission;
      earnedMonth = manualMonth;
    } else if (c.kind === "academy") {
      if (review?.payment_cents != null) {
        status = "confirmed";
        commissionCents = Math.round(review.payment_cents * REP_ACADEMY_CUT);
        earnedMonth = manualMonth;
      } else {
        status = "needs_amount";
      }
    } else if (c.kind === "tour") {
      status = "needs_amount";
    } else if (!userId) {
      status = "waiting_signup";
    } else if (!first) {
      status = "not_paid";
    } else if (first.paidAt * 1000 < new Date(c.created_at).getTime() - graceMs) {
      status = "paid_before_claim";
    } else if (!first.plan) {
      status = "plan_unknown";
    } else {
      status = "confirmed";
      commissionCents = REP_PLAN_COMMISSION_CENTS[first.plan];
      // Lands in the later of payment month and claim month (a claim logged
      // in the grace window after a month-end payment pays next month).
      const paidIso = new Date(first.paidAt * 1000).toISOString();
      earnedMonth = monthOf(paidIso > c.created_at ? paidIso : c.created_at);
    }

    return {
      id: c.id,
      repId: c.rep_id,
      repName: repById.get(c.rep_id)?.name ?? "Unknown rep",
      customerEmail: c.customer_email,
      customerName: c.customer_name,
      kind: c.kind,
      repNote: c.rep_note,
      claimedAt: c.created_at,
      matchedUserId: userId,
      matchedEmail: userId ? emailById.get(userId) ?? null : null,
      linkedManually: !!review?.linked_user_id,
      firstPaidAt: first ? new Date(first.paidAt * 1000).toISOString() : null,
      firstPaidCents: first?.amountCents ?? null,
      plan: first?.plan ?? null,
      status,
      commissionCents,
      earnedMonth,
      conflictWithRep:
        status === "conflict" && owner ? repById.get(owner.rep_id)?.name ?? "another rep" : null,
      review: review
        ? {
            rejected: review.rejected,
            paymentCents: review.payment_cents,
            commissionCents: review.commission_cents,
            earnedOn: review.earned_on,
            note: review.note,
          }
        : null,
    };
  });

  return {
    available: true,
    reps: repRows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      monthlySalaryCents: r.monthly_salary_cents,
      active: r.active,
      createdAt: r.created_at,
    })),
    claims: out.reverse(), // newest first for display
    payouts: payoutRows.map((p) => ({
      id: p.id,
      repId: p.rep_id,
      periodMonth: monthOf(p.period_month),
      salaryCents: p.salary_cents,
      commissionCents: p.commission_cents,
      totalCents: p.total_cents,
      lineItems: p.line_items ?? [],
      paymentReference: p.payment_reference,
      paidAt: p.paid_at,
    })),
  };
}

// Founder view. Founder-session reads (RLS: founders_all, sql/012, and
// founders_read_all on user_profiles).
export const getSalesData = cache(
  (): Promise<SalesData> => loadSalesData(createSupabaseServerClient())
);

// What a rep may see about their own claim. Deliberately coarse: only
// "confirmed" proves the customer exists and paid. Everything a rep could use
// to probe whether an email is a customer (signed up, paid before the claim,
// claimed by another rep) collapses into "pending" or "review".
export type RepClaimStatus = "pending" | "review" | "confirmed" | "not_approved";

export interface RepClaimView {
  id: string;
  customerEmail: string;
  customerName: string | null;
  kind: SalesClaimKind;
  claimedAt: string;
  status: RepClaimStatus;
  commissionCents: number;
  earnedMonth: string | null;
}

export interface RepPortalData {
  name: string;
  monthlySalaryCents: number;
  claims: RepClaimView[];
  payouts: { periodMonth: string; salaryCents: number; commissionCents: number; totalCents: number; paidAt: string }[];
}

const REP_STATUS: Record<ClaimStatus, RepClaimStatus> = {
  waiting_signup: "pending",
  not_paid: "pending",
  needs_amount: "review",
  plan_unknown: "review",
  paid_before_claim: "review",
  conflict: "review",
  confirmed: "confirmed",
  rejected: "not_approved",
};

// Rep view. Uses the service role, with justification: a rep's session
// can't (and must not) read customer profiles, founder reviews, or other
// reps' claims — but all three decide their claim statuses (match, overrides,
// first-claim-wins). The full picture is computed server-side and only the
// calling rep's coarse rows leave this function. repId must come from
// requireRep(), never from the client.
export const getRepPortalData = cache(async (repId: string): Promise<RepPortalData | null> => {
  const data = await loadSalesData(getAdminClient());
  const rep = data.reps.find((r) => r.id === repId);
  if (!rep) return null;

  return {
    name: rep.name,
    monthlySalaryCents: rep.monthlySalaryCents,
    claims: data.claims
      .filter((c) => c.repId === repId)
      .map((c) => ({
        id: c.id,
        customerEmail: c.customerEmail,
        customerName: c.customerName,
        kind: c.kind,
        claimedAt: c.claimedAt,
        status: REP_STATUS[c.status],
        commissionCents: c.status === "confirmed" ? c.commissionCents : 0,
        earnedMonth: c.status === "confirmed" ? c.earnedMonth : null,
      })),
    payouts: data.payouts
      .filter((p) => p.repId === repId)
      .sort((a, b) => b.periodMonth.localeCompare(a.periodMonth))
      .map((p) => ({
        periodMonth: p.periodMonth,
        salaryCents: p.salaryCents,
        commissionCents: p.commissionCents,
        totalCents: p.totalCents,
        paidAt: p.paidAt,
      })),
  };
});

// Confirmed commission lines for one rep in one payout month ("YYYY-MM").
export function commissionLines(claims: SalesClaim[], repId: string, month: string): PayoutLine[] {
  return claims
    .filter((c) => c.repId === repId && c.status === "confirmed" && c.earnedMonth === month)
    .map((c) => ({
      claimId: c.id,
      customerEmail: c.customerEmail,
      kind: c.kind,
      commissionCents: c.commissionCents,
    }));
}
