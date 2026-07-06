import { Card } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/skeleton";
import { getSignupMetrics } from "@/lib/data/signups";
import { getStripeMetrics } from "@/lib/data/stripe-metrics";
import { formatCentsWhole, formatPercent } from "@/lib/format";

function KpiCard({
  label,
  value,
  delta,
  subline,
}: {
  label: string;
  value: string;
  delta?: { pct: number | null };
  subline?: string;
}) {
  const deltaTone =
    delta?.pct == null ? "text-faint" : delta.pct >= 0 ? "text-accent" : "text-danger";
  const deltaSign = delta?.pct != null && delta.pct >= 0 ? "+" : "";

  return (
    <Card>
      <p className="mb-1.5 text-[11px] uppercase tracking-wider text-muted">{label}</p>
      <p className="tnum text-2xl font-semibold leading-none">{value}</p>
      {delta && (
        <p className={`tnum mt-1.5 text-xs ${deltaTone}`}>
          {delta.pct == null ? "—" : `${deltaSign}${formatPercent(delta.pct)} WoW`}
        </p>
      )}
      {subline && <p className="mt-1.5 text-xs text-faint">{subline}</p>}
    </Card>
  );
}

export async function KpiRow() {
  const [signups, stripe] = await Promise.all([getSignupMetrics(), getStripeMetrics()]);
  const { data: stripeMetrics } = stripe;

  const mrrSeries = stripeMetrics.mrrOverTime;
  const currentMrr = mrrSeries.at(-1)?.mrrCents ?? stripeMetrics.mrrCents;
  const previousMrr = mrrSeries.at(-2)?.mrrCents ?? null;
  const mrrDeltaPct =
    previousMrr != null && previousMrr > 0 ? (currentMrr - previousMrr) / previousMrr : null;

  const planSubline = stripeMetrics.planBreakdown
    .map((p) => `${p.subscriberCount} ${p.label}`)
    .join(" · ");

  return (
    <section className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <KpiCard
        label="MRR"
        value={formatCentsWhole(stripeMetrics.mrrCents)}
        delta={{ pct: mrrDeltaPct }}
      />
      <KpiCard
        label="Paying subscribers"
        value={stripeMetrics.payingSubscriberCount.toLocaleString()}
        subline={planSubline || undefined}
      />
      <KpiCard label="Total signups" value={signups.totalSignups.toLocaleString()} />
      <KpiCard
        label="Signup → paid"
        value={formatPercent(signups.signupToPaidConversion)}
      />
      <KpiCard
        label="Signups this week"
        value={signups.wow.current.toLocaleString()}
        delta={{ pct: signups.wow.deltaPct }}
      />
    </section>
  );
}

export function KpiRowSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
