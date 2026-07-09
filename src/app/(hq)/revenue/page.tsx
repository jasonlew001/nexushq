import { Suspense } from "react";
import { requireFounder } from "@/lib/auth";
import { PageShell } from "@/components/page-shell";
import { Card, SectionLabel } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { getStripeMetrics } from "@/lib/data/stripe-metrics";
import { getCustomerRows } from "@/lib/data/customers";
import { MrrOverTimeChart } from "@/components/charts/mrr-over-time";
import { ReferralTable, ReferralTableSkeleton } from "@/components/referral-table";
import { TierDistributionChart } from "@/components/charts/tier-distribution";
import { formatCentsWhole, formatDate, formatPercent } from "@/lib/format";
import { Clock } from "lucide-react";

export const dynamic = "force-dynamic";

function months(days: number | null): string {
  if (days == null) return "—";
  return `${(days / 30.44).toFixed(1)} mo`;
}

async function RevenueSections() {
  const [stripe, customers] = await Promise.all([getStripeMetrics(), getCustomerRows()]);
  const { data: metrics } = stripe;

  const freeCount = customers.filter((c) => c.tier === "free" || !c.tier).length;
  const premiumCount = customers.filter((c) => c.tier === "premium").length;
  const customerByStripeId = new Map(
    customers.filter((c) => c.stripeCustomerId).map((c) => [c.stripeCustomerId!, c])
  );

  return (
    <div className="stagger space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="mb-1.5 text-[11px] uppercase tracking-wider text-muted">MRR</p>
          <p className="tnum text-2xl font-semibold text-gold">
            {formatCentsWhole(metrics.mrrCents)}
          </p>
        </Card>
        <Card>
          <p className="mb-1.5 text-[11px] uppercase tracking-wider text-muted">
            Paying subscribers
          </p>
          <p className="tnum text-2xl font-semibold">{metrics.payingSubscriberCount}</p>
        </Card>
        <Card>
          <p className="mb-1.5 text-[11px] uppercase tracking-wider text-muted">By plan</p>
          {metrics.planBreakdown.length === 0 ? (
            <p className="text-sm text-faint">No paying subscriptions yet</p>
          ) : (
            <div className="space-y-1">
              {metrics.planBreakdown.map((plan) => (
                <div key={plan.label} className="flex items-baseline justify-between text-xs">
                  <span className="text-muted">{plan.label}</span>
                  <span className="tnum">
                    {plan.subscriberCount} · {formatCentsWhole(Math.round(plan.monthlyCents))}/mo
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <SectionLabel>MRR over time (approximate)</SectionLabel>
        <MrrOverTimeChart data={metrics.mrrOverTime} />
        <p className="mt-2 text-xs text-faint">
          Reconstructed from subscription lifecycles at current prices — plan changes are
          attributed to today&apos;s price.
        </p>
      </Card>

      <Card>
        <SectionLabel>Retention</SectionLabel>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="mb-1.5 text-[11px] uppercase tracking-wider text-muted">
              Renewal rate (1st → 2nd period)
            </p>
            <p className="tnum font-mono text-2xl font-semibold text-accent">
              {metrics.retention.renewalRate != null
                ? formatPercent(metrics.retention.renewalRate)
                : "—"}
            </p>
            <p className="mt-1 font-mono text-xs text-faint">
              {metrics.retention.renewed} of {metrics.retention.renewalEligible} eligible
            </p>
            {metrics.retention.byPlan.length > 0 && (
              <div className="mt-2 space-y-0.5">
                {metrics.retention.byPlan.map((plan) => (
                  <div key={plan.label} className="flex justify-between font-mono text-xs">
                    <span className="text-muted">{plan.label}</span>
                    <span className="tnum">
                      {plan.rate != null ? formatPercent(plan.rate) : "—"}{" "}
                      <span className="text-faint">
                        ({plan.renewed}/{plan.eligible})
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="mb-1.5 text-[11px] uppercase tracking-wider text-muted">
              Avg shelf life (ended subs)
            </p>
            <p className="tnum font-mono text-2xl font-semibold">
              {months(metrics.retention.avgEndedLifetimeDays)}
            </p>
            <p className="mt-1 font-mono text-xs text-faint">
              {metrics.retention.endedCount} completed subscription
              {metrics.retention.endedCount === 1 ? "" : "s"}
            </p>
          </div>
          <div>
            <p className="mb-1.5 text-[11px] uppercase tracking-wider text-muted">
              Avg tenure (still active)
            </p>
            <p className="tnum font-mono text-2xl font-semibold">
              {months(metrics.retention.avgActiveTenureDays)}
            </p>
            <p className="mt-1 font-mono text-xs text-faint">
              {metrics.retention.activeCount} active — still accruing, kept separate from
              ended
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-faint">
          Paying subscriptions only (comped/$0 excluded). A sub counts as renewed if it
          survived past its first billing period (+3-day grace); shelf life is from
          subscription start to end.
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionLabel>Tier distribution</SectionLabel>
          <TierDistributionChart free={freeCount} premium={premiumCount} />
        </Card>
        <Card>
          <SectionLabel>Canceling within 14 days</SectionLabel>
          {metrics.cancelingSoon.length === 0 ? (
            <EmptyState icon={Clock} label="No cancellations scheduled" />
          ) : (
            <div className="divide-y divide-edge">
              {metrics.cancelingSoon.map((sub) => {
                const customer = customerByStripeId.get(sub.customerId);
                return (
                  <div
                    key={sub.subscriptionId}
                    className="flex items-center justify-between py-2 text-xs"
                  >
                    <span>{customer?.name ?? sub.customerId}</span>
                    <span className="tnum text-warn">ends {formatDate(sub.currentPeriodEnd)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export default async function RevenuePage() {
  await requireFounder();

  return (
    <PageShell title="Revenue" description="MRR, plans, and subscription health">
      <Suspense
        fallback={
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
            <Skeleton className="h-[280px] w-full rounded-lg" />
          </div>
        }
      >
        <RevenueSections />
      </Suspense>

      <div className="mt-4">
        <Suspense fallback={<ReferralTableSkeleton />}>
          <ReferralTable />
        </Suspense>
      </div>
    </PageShell>
  );
}
