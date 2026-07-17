import { Skeleton } from "@/components/ui/skeleton";
import { LiveDot } from "@/components/ui/live-dot";
import { getAnthropicMetrics } from "@/lib/data/anthropic-metrics";
import { getManualCosts, monthlyBurnCents } from "@/lib/data/costs";
import { getDataFreshness } from "@/lib/data/freshness";
import { getCustomerRows } from "@/lib/data/customers";
import { formatCentsWhole } from "@/lib/format";
import { DATA_STALENESS_WARN_DAYS } from "@/lib/constants";

// Slim, dot-separated ambient readout. Every figure here is real and
// already fetched elsewhere on Overview (React cache()/unstable_cache()
// dedupes the repeat calls to zero extra network cost).
export async function SystemStrip() {
  const [anthropic, manualCosts, freshness, customers] = await Promise.all([
    getAnthropicMetrics(),
    getManualCosts(),
    getDataFreshness(),
    getCustomerRows(),
  ]);

  const monthKey = new Date().toISOString().slice(0, 7);
  const burnCents = anthropic.data.monthToDateCents + Math.round(monthlyBurnCents(manualCosts, monthKey));

  const oldest = freshness.reduce<number | null>(
    (max, d) => (d.ageDays != null && (max == null || d.ageDays > max) ? d.ageDays : max),
    null
  );
  const isStale = oldest != null && oldest > DATA_STALENESS_WARN_DAYS;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
      <span className="tnum">Burn MTD {formatCentsWhole(burnCents)}</span>
      <span className="text-faint">·</span>
      <span className="flex items-center gap-1.5">
        <LiveDot tone={isStale ? "warn" : "accent"} />
        <span className="tnum">
          Data {oldest != null ? `oldest update ${oldest}d ago` : "no timestamps yet"}
        </span>
      </span>
      <span className="text-faint">·</span>
      <span className="tnum">{customers.length.toLocaleString()} accounts</span>
    </div>
  );
}

export function SystemStripSkeleton() {
  return <Skeleton className="h-4 w-80 rounded" />;
}
