import { Skeleton } from "@/components/ui/skeleton";
import { getSignupMetrics } from "@/lib/data/signups";
import { getStripeMetrics } from "@/lib/data/stripe-metrics";
import { formatCentsWhole, formatPercent } from "@/lib/format";
import { Sparkline, MiniBars } from "@/components/overview/mrr-sparkline";
import { cn } from "@/lib/cn";

// Deltas on the brand surface: mint up, a soft red down (both ≥5:1 on
// --brand), as a small pill so the direction reads before the number.
function Delta({ pct, vs }: { pct: number | null; vs: string }) {
  if (pct == null) return <p className="mt-3 text-xs text-white/50">No comparison vs {vs}</p>;
  const up = pct >= 0;
  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <span
        className={cn(
          "tnum whitespace-nowrap rounded-full px-1.5 py-0.5 font-medium",
          up ? "bg-mint/15 text-mint" : "bg-[#F19A9A]/15 text-[#F19A9A]"
        )}
      >
        {up ? "↑" : "↓"} {formatPercent(Math.abs(pct))}
      </span>
      <span className="text-white/50">vs {vs}</span>
    </p>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] font-medium text-white/60">{children}</p>;
}

// The pulse band: the three numbers that say how the business is doing, on
// the Nexus fairway green with MRR in the brand gold. One panel instead of
// three identical cards. MRR leads (wider, bigger) with its 26-week line;
// the two counts get bar strips, since they're discrete per-period counts.
export async function KpiRow() {
  const [signups, stripe] = await Promise.all([getSignupMetrics(), getStripeMetrics()]);
  const { data: s } = stripe;

  const mrrSeries = s.mrrOverTime;
  const currentMrr = mrrSeries.at(-1)?.mrrCents ?? s.mrrCents;
  const previousMrr = mrrSeries.at(-2)?.mrrCents ?? null;
  const mrrDeltaPct = previousMrr != null && previousMrr > 0 ? (currentMrr - previousMrr) / previousMrr : null;

  const conversion = signups.totalSignups > 0 ? s.payingSubscriberCount / signups.totalSignups : null;

  return (
    <section
      className="relative grid grid-cols-1 overflow-hidden rounded-xl bg-brand text-white md:grid-cols-[1.5fr_1fr_1fr]"
      style={{
        // A soft light source top-left: depth without a visible gradient band.
        backgroundImage:
          "radial-gradient(90% 120% at 0% 0%, hsl(160 45% 22% / 0.9) 0%, transparent 60%), radial-gradient(60% 80% at 100% 100%, hsl(159 61% 9% / 0.7) 0%, transparent 70%)",
      }}
    >
      <div className="flex flex-col">
        <div className="px-6 pt-6">
          <Label>Monthly recurring revenue</Label>
          <p className="font-display mt-2 text-[52px] leading-none text-brand-gold">{formatCentsWhole(s.mrrCents)}</p>
          <Delta pct={mrrDeltaPct} vs="last week" />
        </div>
        <div className="mt-auto pt-4">
          <Sparkline points={mrrSeries.map((p) => p.mrrCents)} colorVar="--brand-gold" className="h-[72px]" />
        </div>
      </div>

      <div className="flex flex-col border-t border-white/10 md:border-l md:border-t-0">
        <div className="px-6 pt-6">
          <Label>Paying subscribers</Label>
          <p className="font-display mt-2 text-[40px] leading-none">{s.payingSubscriberCount.toLocaleString()}</p>
          <p className="mt-3 text-xs text-white/50">
            {conversion != null ? (
              <>
                <span className="font-medium text-white/85">{formatPercent(conversion)}</span> of{" "}
                {signups.totalSignups.toLocaleString()} signups pay
              </>
            ) : (
              "No signups yet"
            )}
          </p>
        </div>
        <div className="mt-auto px-6 pb-5 pt-5">
          {/* New paying signups per week: a shape, not the headline total. */}
          <MiniBars points={signups.weeklyPayingOnly.slice(-12).map((w) => w.total)} colorVar="--mint" className="h-9" />
          <p className="mt-1.5 text-[11px] text-white/40">New paying per week · 12 weeks</p>
        </div>
      </div>

      <div className="flex flex-col border-t border-white/10 md:border-l md:border-t-0">
        <div className="px-6 pt-6">
          <Label>Signups · last 7 days</Label>
          <p className="font-display mt-2 text-[40px] leading-none">{signups.last7Days.current.toLocaleString()}</p>
          <Delta pct={signups.last7Days.deltaPct} vs="prior 7 days" />
        </div>
        <div className="mt-auto px-6 pb-5 pt-5">
          <MiniBars points={signups.dailySignups.map((d) => d.count)} colorVar="--mint" className="h-9" />
          <p className="mt-1.5 text-[11px] text-white/40">Per day</p>
        </div>
      </div>
    </section>
  );
}

export function KpiRowSkeleton() {
  return (
    <div className="grid h-[232px] grid-cols-1 gap-6 rounded-xl bg-brand p-6 md:grid-cols-[1.5fr_1fr_1fr]">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-3 opacity-25">
          <Skeleton className="h-3 w-32" />
          <Skeleton className={i === 0 ? "h-12 w-44" : "h-10 w-20"} />
          <Skeleton className="h-3 w-28" />
        </div>
      ))}
    </div>
  );
}
