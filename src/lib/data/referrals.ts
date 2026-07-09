import { unstable_cache } from "next/cache";
import { getStripe } from "@/lib/stripe";
import { COACH_REFERRAL_CUT } from "@/lib/constants";
import type { CachedResult } from "@/lib/types";

if (typeof window !== "undefined") {
  throw new Error("referrals.ts must never be imported client-side");
}

export interface ReferralCodeStats {
  code: string; // the human-facing code string, e.g. NICKB20
  active: boolean;
  timesRedeemed: number; // Stripe's own counter (includes non-paying redemptions)
  customerCount: number; // customers whose FIRST promo-bearing paid invoice used this code
  firstPurchaseCents: number; // sum of those first invoices' amount_paid
  coachCutCents: number; // COACH_REFERRAL_CUT of firstPurchaseCents
  referredLifetimeCents: number; // all-time paid revenue of those customers
}

function promoIdFromDiscount(d: unknown): string | null {
  if (!d || typeof d === "string") return null;
  const promo = (d as { promotion_code?: string | { id: string } | null }).promotion_code;
  if (!promo) return null;
  return typeof promo === "string" ? promo : promo.id;
}

async function fetchReferralStats(): Promise<CachedResult<ReferralCodeStats[]>> {
  const stripe = getStripe();

  // All promotion codes ever created — each coach's referral code, keyed by
  // promo-code id (which is what invoice discounts reference).
  const codesById = new Map<string, { code: string; active: boolean; timesRedeemed: number }>();
  for await (const promo of stripe.promotionCodes.list({ limit: 100 })) {
    codesById.set(promo.id, {
      code: promo.code,
      active: promo.active,
      timesRedeemed: promo.times_redeemed,
    });
  }

  // One pass over all paid invoices: per customer, accumulate lifetime
  // revenue and find the EARLIEST invoice that carried a promotion code —
  // that invoice defines which coach gets credit ("first purchase with the
  // code") and its amount is the base for the 25% cut.
  interface CustomerAgg {
    lifetimeCents: number;
    firstPromo: { created: number; amountCents: number; promoId: string } | null;
  }
  const byCustomer = new Map<string, CustomerAgg>();

  for await (const invoice of stripe.invoices.list({
    status: "paid",
    limit: 100,
    expand: ["data.discounts"],
  })) {
    const customerId =
      typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
    if (!customerId) continue;

    let agg = byCustomer.get(customerId);
    if (!agg) {
      agg = { lifetimeCents: 0, firstPromo: null };
      byCustomer.set(customerId, agg);
    }
    agg.lifetimeCents += invoice.amount_paid;

    const promoId = (invoice.discounts ?? []).map(promoIdFromDiscount).find(Boolean) ?? null;
    if (promoId && (!agg.firstPromo || invoice.created < agg.firstPromo.created)) {
      agg.firstPromo = { created: invoice.created, amountCents: invoice.amount_paid, promoId };
    }
  }

  // Roll customers up into per-code stats.
  const statsByPromoId = new Map<
    string,
    { customerCount: number; firstPurchaseCents: number; referredLifetimeCents: number }
  >();
  for (const agg of Array.from(byCustomer.values())) {
    if (!agg.firstPromo) continue;
    const s = statsByPromoId.get(agg.firstPromo.promoId) ?? {
      customerCount: 0,
      firstPurchaseCents: 0,
      referredLifetimeCents: 0,
    };
    s.customerCount += 1;
    s.firstPurchaseCents += agg.firstPromo.amountCents;
    s.referredLifetimeCents += agg.lifetimeCents;
    statsByPromoId.set(agg.firstPromo.promoId, s);
  }

  // Aggregate by the human-facing code STRING, not promo-code id — Stripe
  // allows recreating a code (deactivate + new object with the same
  // string), and the live account has several such pairs. A coach's ledger
  // should be one row per code regardless of how many Stripe objects have
  // carried it. "Active" = any incarnation currently active. Every code
  // appears, even with zero paying redemptions (times_redeemed can be > 0
  // without a paid invoice — e.g. redeemed on a trial).
  const byCode = new Map<string, ReferralCodeStats>();
  for (const [id, meta] of Array.from(codesById.entries())) {
    const s = statsByPromoId.get(id);
    const existing = byCode.get(meta.code) ?? {
      code: meta.code,
      active: false,
      timesRedeemed: 0,
      customerCount: 0,
      firstPurchaseCents: 0,
      coachCutCents: 0,
      referredLifetimeCents: 0,
    };
    existing.active = existing.active || meta.active;
    existing.timesRedeemed += meta.timesRedeemed;
    existing.customerCount += s?.customerCount ?? 0;
    existing.firstPurchaseCents += s?.firstPurchaseCents ?? 0;
    existing.referredLifetimeCents += s?.referredLifetimeCents ?? 0;
    byCode.set(meta.code, existing);
  }
  const rows = Array.from(byCode.values()).map((r) => ({
    ...r,
    coachCutCents: Math.round(r.firstPurchaseCents * COACH_REFERRAL_CUT),
  }));
  rows.sort((a, b) => b.referredLifetimeCents - a.referredLifetimeCents);

  return { data: rows, fetchedAt: new Date().toISOString() };
}

export const getReferralStats = unstable_cache(fetchReferralStats, ["hq-referral-stats"], {
  revalidate: 3600,
  tags: ["hq-stripe-referrals"],
});
