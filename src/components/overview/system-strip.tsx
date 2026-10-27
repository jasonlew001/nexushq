import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { getAnthropicMetrics } from "@/lib/data/anthropic-metrics";
import { getManualCosts, monthlyBurnCents } from "@/lib/data/costs";
import { getCustomerRows } from "@/lib/data/customers";
import { formatCentsWhole } from "@/lib/format";

// Slim, dot-separated ambient readout. Every figure here is real and
// already fetched elsewhere on Overview (React cache()/unstable_cache()
// dedupes the repeat calls to zero extra network cost).
//
// The "data oldest update Nd ago" readout that used to sit here is gone: it
// read newest created_at per product table, and in-place refreshes (e.g. the
// College Scorecard academics refresh) don't touch created_at, so it showed
// a permanent amber "197d ago" false alarm. The /data ledger keeps the
// per-table detail with that caveat.
export async function SystemStrip() {
  const [anthropic, manualCosts, customers] = await Promise.all([
    getAnthropicMetrics(),
    getManualCosts(),
    getCustomerRows(),
  ]);

  const monthKey = new Date().toISOString().slice(0, 7);
  const burnCents = anthropic.data.monthToDateCents + Math.round(monthlyBurnCents(manualCosts, monthKey));

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-edge pt-4 text-xs text-muted">
      <Link href="/costs" className="tnum hover:text-ink">
        Burn this month {formatCentsWhole(burnCents)}
        {anthropic.data.error ? (
          <span className="text-warn" title={anthropic.data.error}>
            {" "}
            (excl. Anthropic)
          </span>
        ) : null}
      </Link>
      <span className="text-faint">·</span>
      <Link href="/customers" className="tnum hover:text-ink">
        {customers.length.toLocaleString()} accounts
      </Link>
      <span className="text-faint">·</span>
      <Link href="/data" className="hover:text-ink">
        Product data ledger
      </Link>
    </div>
  );
}

export function SystemStripSkeleton() {
  return <Skeleton className="h-4 w-80 rounded" />;
}
