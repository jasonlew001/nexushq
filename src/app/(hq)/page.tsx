import { Suspense } from "react";
import { requireFounder } from "@/lib/auth";
import { KpiRow, KpiRowSkeleton } from "@/components/kpi-row";
import { TrendRow, TrendRowSkeleton } from "@/components/overview/trend-row";
import { ActionStrip, ActionStripSkeleton } from "@/components/action-strip";
import { OverviewCards, OverviewCardsSkeleton } from "@/components/overview-cards";
import { SystemStrip, SystemStripSkeleton } from "@/components/overview/system-strip";

export const dynamic = "force-dynamic";

// The Fieldra-style overview, top to bottom: 3 KPI cards, the big signups
// trend chart + breakdown panel, then attention + sections side by side,
// with an ambient system-status footer.
export default async function OverviewPage() {
  await requireFounder();

  return (
    <div className="space-y-6">
      <Suspense fallback={<KpiRowSkeleton />}>
        <KpiRow />
      </Suspense>

      <Suspense fallback={<TrendRowSkeleton />}>
        <TrendRow />
      </Suspense>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Suspense fallback={<ActionStripSkeleton />}>
          <ActionStrip />
        </Suspense>

        <Suspense fallback={<OverviewCardsSkeleton />}>
          <OverviewCards />
        </Suspense>
      </div>

      <Suspense fallback={<SystemStripSkeleton />}>
        <SystemStrip />
      </Suspense>
    </div>
  );
}
