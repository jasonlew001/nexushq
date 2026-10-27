import { Skeleton } from "@/components/ui/skeleton";
import { getSignupMetrics } from "@/lib/data/signups";
import { getStripeMetrics } from "@/lib/data/stripe-metrics";
import { formatCentsWhole, formatPercent } from "@/lib/format";
import { Sparkline } from "@/components/overview/mrr-sparkline";
import { cn } from "@/lib/cn";

// Deltas on the brand surface: mint up, a soft red down (both ≥5:1 on
// --brand), with the comparison in the band's own muted white.
function Delta({ pct, vs }: { pct: number | null; vs: string }) {
  if (pct == null) return <p className="mt-2 text-xs text-white/55">no comparison vs {vs}</p>;
  const up = pct >= 0;
  return (
    <p className={cn("mt-2 text-xs", up ? "text-mint" : "text-[#F19A9A]")}>
      {up ? "▲" : "▼"} {formatPercent(Math.abs(pct))} <span className="text-white/55">vs {vs}</span>
    </p>
  );
}

// The pulse band: the three numbers that say how the business is doing, on
// the Nexus fairway green with MRR in large gold serif numerals (the main
// site's own brand move). One panel instead of three identical cards; MRR
// leads and its 26-week line runs along the panel's floor.
export async function KpiRow() {
  const [signups, stripe] = await Promise.all([getSignupMetrics(), getStripeMetrics()]);
  const { data: s } = stripe;

  const mrrSeries = s.mrrOverTime;
  const currentMrr = mrrSeries.at(-1)?.mrrCents ?? s.mrrCents;
  const previousMrr = mrrSeries.at(-2)?.mrrCents ?? null;
  const mrrDeltaPct = previousMrr != null && previousMrr > 0 ? (currentMrr - previousMrr) / previousMrr : null;

  const conversion = signups.totalSignups > 0 ? s.payingSubscriberCount / signups.totalSignups : null;

  return (
    <section className="grid grid-cols-1 overflow-hidden rounded-xl bg-brand text-white md:grid-cols-[1.45fr_1fr_1fr]">
      <div className="flex flex-col justify-between">
        <div className="px-6 pb-3 pt-6">
          <p className="text-[13px] text-white/65">Monthly recurring revenue</p>
          <p className="font-display mt-3 text-[64px] leading-[0.85] text-brand-gold">{formatCentsWhole(s.mrrCents)}</p>
          <Delta pct={mrrDeltaPct} vs="last week" />
        </div>
        <Sparkline points={mrrSeries.map((p) => p.mrrCents)} colorVar="--brand-gold" className="h-16" />
      </div>

      <div className="flex flex-col justify-between border-t border-white/10 md:border-l md:border-t-0">
        <div className="px-6 pb-3 pt-6">
          <p className="text-[13px] text-white/65">Paying subscribers</p>
          <p className="font-display mt-3 text-[48px] leading-[0.85]">{s.payingSubscriberCount.toLocaleString()}</p>
          <p className="mt-2 text-xs text-white/80">
            {conversion != null ? (
              <>
                {formatPercent(conversion)}{" "}
                <span className="text-white/55">of {signups.totalSignups.toLocaleString()} signups pay</span>
              </>
            ) : (
              <span className="text-white/55">no signups yet</span>
            )}
          </p>
        </div>
        {/* New paying signups per week: a shape, not the headline total. */}
        <Sparkline points={signups.weeklyPayingOnly.map((w) => w.total)} colorVar="--mint" className="h-16" />
      </div>

      <div className="flex flex-col justify-between border-t border-white/10 md:border-l md:border-t-0">
        <div className="px-6 pb-3 pt-6">
          <p className="text-[13px] text-white/65">Signups · last 7 days</p>
          <p className="font-display mt-3 text-[48px] leading-[0.85]">{signups.last7Days.current.toLocaleString()}</p>
          <Delta pct={signups.last7Days.deltaPct} vs="prior 7 days" />
        </div>
        <Sparkline points={signups.dailySignups.map((d) => d.count)} colorVar="--mint" className="h-16" />
      </div>
    </section>
  );
}

export function KpiRowSkeleton() {
  return (
    <div className="grid h-[226px] grid-cols-1 gap-6 rounded-xl bg-brand p-6 md:grid-cols-[1.45fr_1fr_1fr]">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-3 opacity-25">
          <Skeleton className="h-3 w-32" />
          <Skeleton className={i === 0 ? "h-14 w-44" : "h-11 w-20"} />
          <Skeleton className="h-3 w-28" />
        </div>
      ))}
    </div>
  );
}
