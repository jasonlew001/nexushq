import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getSignupMetrics } from "@/lib/data/signups";
import { getStripeMetrics } from "@/lib/data/stripe-metrics";
import { formatCentsWhole, formatPercent } from "@/lib/format";
import { MrrSparkline } from "@/components/overview/mrr-sparkline";
import { PlanMixBar } from "@/components/overview/plan-mix-bar";
import { SignupFunnel } from "@/components/overview/signup-funnel";

function DeltaPill({ pct }: { pct: number | null }) {
  const tone = pct == null ? "text-faint" : pct >= 0 ? "text-accent" : "text-danger";
  const sign = pct != null && pct >= 0 ? "+" : "";
  return (
    <span
      className={`tnum inline-block rounded-full bg-surface-2 px-2 py-0.5 font-mono text-xs ${tone}`}
    >
      {pct == null ? "—" : `${sign}${formatPercent(pct)} WoW`}
    </span>
  );
}

// The Hero grid: MRR panel (gold, the arc-reactor centerpiece) + Funnel
// panel, side by side (~1.5fr/1fr), stacking to one column on narrow
// viewports. Names kept as KpiRow/KpiRowSkeleton — same export contract
// the Overview page already imports.
export async function KpiRow() {
  const [signups, stripe] = await Promise.all([getSignupMetrics(), getStripeMetrics()]);
  const { data: stripeMetrics } = stripe;

  const mrrSeries = stripeMetrics.mrrOverTime;
  const currentMrr = mrrSeries.at(-1)?.mrrCents ?? stripeMetrics.mrrCents;
  const previousMrr = mrrSeries.at(-2)?.mrrCents ?? null;
  const mrrDeltaPct =
    previousMrr != null && previousMrr > 0 ? (currentMrr - previousMrr) / previousMrr : null;

  return (
    <section className="stagger grid grid-cols-1 gap-4 sm:grid-cols-[1.5fr_1fr]">
      <Card className="relative overflow-hidden">
        <div className="relative flex items-start justify-between">
          <div>
            <p className="mb-1.5 font-mono text-[11px] uppercase tracking-wider text-muted">MRR</p>
            <p className="tnum font-mono text-3xl font-semibold leading-none text-gold">
              {formatCentsWhole(stripeMetrics.mrrCents)}
            </p>
          </div>
          <DeltaPill pct={mrrDeltaPct} />
        </div>

        <div className="relative mt-4">
          <MrrSparkline series={mrrSeries} />
        </div>

        <div className="relative mt-4">
          <PlanMixBar plans={stripeMetrics.planBreakdown} />
          <p className="mt-2 font-mono text-[11px] text-faint">
            {stripeMetrics.payingSubscriberCount} paying · plan mix
          </p>
        </div>
      </Card>

      <Card hud hudTone="accent">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-wider text-muted">Funnel</p>
        <SignupFunnel signups={signups.totalSignups} paying={signups.payingSubscribers} />
      </Card>
    </section>
  );
}

export function KpiRowSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1.5fr_1fr]">
      <Skeleton className="h-[220px] w-full rounded-lg" />
      <Skeleton className="h-[220px] w-full rounded-lg" />
    </div>
  );
}
