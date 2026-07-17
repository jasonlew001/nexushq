import { CircleDollarSign, Users, UserPlus, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getSignupMetrics } from "@/lib/data/signups";
import { getStripeMetrics } from "@/lib/data/stripe-metrics";
import { formatCentsWhole, formatPercent } from "@/lib/format";
import { Sparkline } from "@/components/overview/mrr-sparkline";

function DeltaLine({ pct }: { pct: number | null }) {
  if (pct == null) {
    return <p className="mt-1 text-xs text-faint">— vs last week</p>;
  }
  const up = pct >= 0;
  return (
    <p className={`mt-1 text-xs ${up ? "text-accent" : "text-danger"}`}>
      {up ? "▲" : "▼"} {formatPercent(Math.abs(pct))} vs last week
    </p>
  );
}

function KpiCard({
  label,
  icon: Icon,
  value,
  valueClassName = "",
  deltaPct,
  sparklinePoints,
  sparklineColorVar,
}: {
  label: string;
  icon: LucideIcon;
  value: string;
  valueClassName?: string;
  deltaPct: number | null;
  sparklinePoints: number[];
  sparklineColorVar: string;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted">{label}</p>
          <p className={`tnum mt-1.5 text-2xl font-semibold leading-none ${valueClassName}`}>{value}</p>
          <DeltaLine pct={deltaPct} />
        </div>
        <span className="rounded-md bg-surface-2 p-1.5">
          <Icon className="h-4 w-4 text-muted" strokeWidth={1.75} />
        </span>
      </div>
      <div className="-mx-4 -mb-4 mt-3">
        <Sparkline points={sparklinePoints} colorVar={sparklineColorVar} />
      </div>
    </Card>
  );
}

// Three KPI cards: MRR, paying subscribers, signups this week — each with
// an icon, a WoW delta line, and a sparkline running along the bottom.
export async function KpiRow() {
  const [signups, stripe] = await Promise.all([getSignupMetrics(), getStripeMetrics()]);
  const { data: stripeMetrics } = stripe;

  const mrrSeries = stripeMetrics.mrrOverTime;
  const currentMrr = mrrSeries.at(-1)?.mrrCents ?? stripeMetrics.mrrCents;
  const previousMrr = mrrSeries.at(-2)?.mrrCents ?? null;
  const mrrDeltaPct =
    previousMrr != null && previousMrr > 0 ? (currentMrr - previousMrr) / previousMrr : null;

  // weeklyPayingOnly tracks *new* paying signups per week (a different
  // cohort than the total subscriber count above it) — good for a shape,
  // not a defensible WoW delta against the headline total.
  const payingSeries = signups.weeklyPayingOnly.map((w) => w.total);

  const dailySeries = signups.dailySignups.map((d) => d.count);

  return (
    <section className="stagger grid grid-cols-1 gap-4 sm:grid-cols-3">
      <KpiCard
        label="MRR"
        icon={CircleDollarSign}
        value={formatCentsWhole(stripeMetrics.mrrCents)}
        valueClassName="text-gold"
        deltaPct={mrrDeltaPct}
        sparklinePoints={mrrSeries.map((s) => s.mrrCents)}
        sparklineColorVar="--gold"
      />
      <KpiCard
        label="Paying subscribers"
        icon={Users}
        value={stripeMetrics.payingSubscriberCount.toLocaleString()}
        deltaPct={null}
        sparklinePoints={payingSeries}
        sparklineColorVar="--accent"
      />
      <KpiCard
        label="Signups this week"
        icon={UserPlus}
        value={signups.wow.current.toLocaleString()}
        deltaPct={signups.wow.deltaPct}
        sparklinePoints={dailySeries}
        sparklineColorVar="--accent"
      />
    </section>
  );
}

export function KpiRowSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Skeleton className="h-[148px] w-full rounded-lg" />
      <Skeleton className="h-[148px] w-full rounded-lg" />
      <Skeleton className="h-[148px] w-full rounded-lg" />
    </div>
  );
}
