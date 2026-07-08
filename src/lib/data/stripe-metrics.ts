import { unstable_cache } from "next/cache";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { startOfWeekUTC, weeksAgoUTC } from "@/lib/format";
import { CHART_WEEKS, CANCELING_SOON_WINDOW_DAYS, COST_HISTORY_MONTHS } from "@/lib/constants";
import type { CachedResult } from "@/lib/types";

if (typeof window !== "undefined") {
  throw new Error("stripe-metrics.ts must never be imported client-side");
}

export interface PlanLabel {
  label: string;
  monthlyCents: number;
  subscriberCount: number;
}

export interface StripeMetrics {
  mrrCents: number;
  payingSubscriberCount: number;
  planBreakdown: PlanLabel[];
  mrrOverTime: { weekStart: string; mrrCents: number }[];
  // Same lifecycle reconstruction as mrrOverTime, bucketed by calendar
  // month (MRR evaluated at each month's end; current month at "now") over
  // the costs-vs-revenue window. Approximate for the same reasons.
  mrrByMonth: { month: string; mrrCents: number }[];
  cancelingSoon: {
    subscriptionId: string;
    customerId: string;
    currentPeriodEnd: string;
  }[];
}

// The three known live prices normalize by interval/interval_count rather
// than by price ID, so a TEST-vs-LIVE ID mismatch (or a future 4th plan)
// degrades to a generic label instead of silently mislabeling.
function planLabel(interval: Stripe.Price.Recurring.Interval, intervalCount: number): string {
  if (interval === "month" && intervalCount === 1) return "Monthly";
  if (interval === "month" && intervalCount === 6) return "6-Month";
  if (interval === "year" && intervalCount === 1) return "Annual";
  return `${intervalCount} ${interval}${intervalCount > 1 ? "s" : ""}`;
}

function normalizeToMonthlyCents(
  unitAmount: number,
  interval: Stripe.Price.Recurring.Interval,
  intervalCount: number
): number {
  switch (interval) {
    case "year":
      return unitAmount / (12 * intervalCount);
    case "month":
      return unitAmount / intervalCount;
    case "week":
      return (unitAmount * (52 / 12)) / intervalCount;
    case "day":
      return (unitAmount * (365.25 / 12)) / intervalCount;
    default:
      return unitAmount;
  }
}

interface NormalizedSub {
  id: string;
  customerId: string;
  status: Stripe.Subscription.Status;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: number; // unix seconds
  createdAt: number;
  endedAt: number | null;
  monthlyCents: number;
  label: string;
}

async function fetchAllSubscriptions(): Promise<NormalizedSub[]> {
  const stripe = getStripe();
  const subs: NormalizedSub[] = [];

  for await (const sub of stripe.subscriptions.list({
    status: "all",
    limit: 100,
    expand: ["data.items.data.price"],
  })) {
    const item = sub.items.data[0];
    const price = item?.price;
    if (!price?.recurring || price.unit_amount == null) continue;

    const monthlyCents = normalizeToMonthlyCents(
      price.unit_amount,
      price.recurring.interval,
      price.recurring.interval_count
    );

    subs.push({
      id: sub.id,
      customerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      status: sub.status,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      currentPeriodEnd: item.current_period_end,
      createdAt: sub.created,
      endedAt: sub.ended_at,
      monthlyCents,
      label: planLabel(price.recurring.interval, price.recurring.interval_count),
    });
  }

  return subs;
}

async function fetchStripeMetrics(): Promise<CachedResult<StripeMetrics>> {
  const subs = await fetchAllSubscriptions();

  // MRR: active + past_due count; trialing excluded (flip here if that
  // policy changes).
  const paying = subs.filter((s) => s.status === "active" || s.status === "past_due");
  const mrrCents = paying.reduce((sum, s) => sum + s.monthlyCents, 0);

  const byLabel = new Map<string, PlanLabel>();
  for (const s of paying) {
    const existing = byLabel.get(s.label) ?? { label: s.label, monthlyCents: 0, subscriberCount: 0 };
    existing.monthlyCents += s.monthlyCents;
    existing.subscriberCount += 1;
    byLabel.set(s.label, existing);
  }
  const planBreakdown = Array.from(byLabel.values()).sort((a, b) => b.monthlyCents - a.monthlyCents);

  // MRR over time (v1, approximate): reconstructed from subscription
  // created/ended lifecycles at each sub's CURRENT price — a historical
  // plan change is misattributed to today's price. No webhooks or
  // invoice-history pipeline required; footnoted "approximate" in the UI.
  const earliestWeek = startOfWeekUTC(weeksAgoUTC(CHART_WEEKS - 1));
  const now = Date.now() / 1000;
  const weekStarts: string[] = [];
  for (let i = CHART_WEEKS - 1; i >= 0; i--) {
    weekStarts.push(startOfWeekUTC(weeksAgoUTC(i)));
  }

  const mrrOverTime = weekStarts.map((weekStart) => {
    const weekStartSec = new Date(weekStart).getTime() / 1000;
    const weekEndSec = weekStartSec + 7 * 24 * 60 * 60;
    const mrrAtWeek = subs.reduce((sum, s) => {
      const started = s.createdAt <= weekEndSec;
      const stillActive = s.endedAt == null || s.endedAt > weekStartSec;
      return started && stillActive ? sum + s.monthlyCents : sum;
    }, 0);
    return { weekStart, mrrCents: Math.round(mrrAtWeek) };
  });
  void earliestWeek; // reserved for future exact-window trimming

  // Monthly MRR: evaluate the same lifecycle test at each month's end
  // (current month at "now" since it hasn't ended yet).
  const nowDate = new Date();
  const mrrByMonth = Array.from({ length: COST_HISTORY_MONTHS }, (_, idx) => {
    const i = COST_HISTORY_MONTHS - 1 - idx;
    const monthStart = new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth() - i, 1));
    const nextMonthStart = new Date(
      Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1)
    );
    const evalSec = Math.min(nextMonthStart.getTime() / 1000, now);
    const mrrAtMonth = subs.reduce((sum, s) => {
      const started = s.createdAt <= evalSec;
      const stillActive = s.endedAt == null || s.endedAt > evalSec;
      return started && stillActive ? sum + s.monthlyCents : sum;
    }, 0);
    return { month: monthStart.toISOString().slice(0, 7), mrrCents: Math.round(mrrAtMonth) };
  });

  const windowEndSec = now + CANCELING_SOON_WINDOW_DAYS * 24 * 60 * 60;
  const cancelingSoon = subs
    .filter(
      (s) =>
        s.status === "active" &&
        s.cancelAtPeriodEnd &&
        s.currentPeriodEnd <= windowEndSec
    )
    .map((s) => ({
      subscriptionId: s.id,
      customerId: s.customerId,
      currentPeriodEnd: new Date(s.currentPeriodEnd * 1000).toISOString(),
    }));

  return {
    data: {
      mrrCents: Math.round(mrrCents),
      payingSubscriberCount: paying.length,
      planBreakdown,
      mrrOverTime,
      mrrByMonth,
      cancelingSoon,
    },
    fetchedAt: new Date().toISOString(),
  };
}

export const getStripeMetrics = unstable_cache(fetchStripeMetrics, ["hq-stripe-metrics"], {
  revalidate: 600,
  tags: ["hq-stripe"],
});

async function fetchLifetimeRevenue(): Promise<CachedResult<Map<string, number>>> {
  const stripe = getStripe();
  const byCustomer = new Map<string, number>();

  for await (const invoice of stripe.invoices.list({ status: "paid", limit: 100 })) {
    const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
    if (!customerId) continue;
    byCustomer.set(customerId, (byCustomer.get(customerId) ?? 0) + invoice.amount_paid);
  }

  return { data: byCustomer, fetchedAt: new Date().toISOString() };
}

const getLifetimeRevenueCached = unstable_cache(
  async () => {
    const result = await fetchLifetimeRevenue();
    // Map isn't structured-cloneable by unstable_cache — serialize to entries.
    return { data: Array.from(result.data.entries()), fetchedAt: result.fetchedAt };
  },
  ["hq-lifetime-revenue"],
  { revalidate: 3600, tags: ["hq-stripe-revenue"] }
);

export async function getLifetimeRevenue(): Promise<CachedResult<Map<string, number>>> {
  const result = await getLifetimeRevenueCached();
  return { data: new Map(result.data), fetchedAt: result.fetchedAt };
}
