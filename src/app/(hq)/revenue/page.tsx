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
import { formatCentsWhole, formatDate } from "@/lib/format";
import { Clock } from "lucide-react";

export const dynamic = "force-dynamic";

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
