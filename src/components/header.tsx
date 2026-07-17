import { Suspense } from "react";
import Link from "next/link";
import { getStripeMetrics } from "@/lib/data/stripe-metrics";
import { formatCentsWhole } from "@/lib/format";
import { SyncButton } from "./sync-button";

async function MrrChip() {
  const { data } = await getStripeMetrics();
  return (
    <span className="tnum inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted">
      MRR <span className="font-medium text-gold">{formatCentsWhole(data.mrrCents)}</span>
    </span>
  );
}

function MrrChipSkeleton() {
  return (
    <span className="tnum inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs text-faint">
      MRR —
    </span>
  );
}

export function Header() {
  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4 pb-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-muted">
          <span>{todayLabel}</span>
          <span className="text-faint">·</span>
          <Suspense fallback={<MrrChipSkeleton />}>
            <MrrChip />
          </Suspense>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <Link
          href="/customers"
          className="rounded-md border border-edge bg-surface px-3.5 py-2 text-[13px] text-ink transition-colors hover:border-edge-strong"
        >
          View customers
        </Link>
        <SyncButton />
      </div>
    </header>
  );
}
