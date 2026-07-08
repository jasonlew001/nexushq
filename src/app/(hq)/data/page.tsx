import { Suspense } from "react";
import { requireFounder } from "@/lib/auth";
import { PageShell } from "@/components/page-shell";
import { FreshnessLedger, FreshnessLedgerSkeleton } from "@/components/data/freshness-ledger";

export const dynamic = "force-dynamic";

export default async function DataPage() {
  await requireFounder();

  return (
    <PageShell
      title="Data health"
      description="When each product dataset was last loaded — newest row per table"
    >
      <Suspense fallback={<FreshnessLedgerSkeleton />}>
        <FreshnessLedger />
      </Suspense>
      <p className="mt-4 text-xs text-faint">
        Most of these tables only stamp rows at insert time, so &ldquo;updated&rdquo; means the
        newest row loaded — an in-place edit without a timestamp column won&apos;t move it.
      </p>
    </PageShell>
  );
}
