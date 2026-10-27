import { Suspense } from "react";
import Link from "next/link";
import { getStripeMetrics } from "@/lib/data/stripe-metrics";
import { formatCentsWhole } from "@/lib/format";
import { SyncButton } from "./sync-button";

// Header chrome, rendered on every route — degrades to a dash instead of
// throwing, for the same reason as RefreshedAt. The real MRR card on
// Overview is inside a SectionBoundary and reports failure properly.
async function MrrChip() {
  let mrrCents: number | null = null;
  try {
    mrrCents = (await getStripeMetrics()).data.mrrCents;
  } catch (err) {
    console.error("MrrChip: Stripe fetch failed", err);
  }

  return (
    <span className="tnum inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted">
      MRR{" "}
      <span className="font-medium text-gold">
        {mrrCents == null ? "—" : formatCentsWhole(mrrCents)}
      </span>
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

// Slim toolbar on every route: today, the MRR chip, and the two global
// actions. Page titles live in each page (PageShell / Overview) so every
// route has exactly one headline.
export function Header() {
  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <header className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-edge pb-4">
      <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
        <span>{todayLabel}</span>
        <span className="text-faint">·</span>
        <Suspense fallback={<MrrChipSkeleton />}>
          <MrrChip />
        </Suspense>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href="/customers"
          className="rounded-md border border-edge bg-surface px-3 py-1.5 text-[13px] text-ink transition-colors hover:border-edge-strong"
        >
          View customers
        </Link>
        <SyncButton />
      </div>
    </header>
  );
}
