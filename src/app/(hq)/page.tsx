import { Suspense } from "react";
import { requireFounder } from "@/lib/auth";
import { ActionStrip, ActionStripSkeleton } from "@/components/action-strip";
import { KpiRow, KpiRowSkeleton } from "@/components/kpi-row";
import { OverviewCards, OverviewCardsSkeleton } from "@/components/overview-cards";

export const dynamic = "force-dynamic";

// The command-center home: what needs attention, the headline numbers, and
// the section cards that zoom into detail pages.
export default async function OverviewPage() {
  await requireFounder();

  return (
    <div className="space-y-6">
      <Suspense fallback={<ActionStripSkeleton />}>
        <ActionStrip />
      </Suspense>

      <Suspense fallback={<KpiRowSkeleton />}>
        <KpiRow />
      </Suspense>

      <Suspense fallback={<OverviewCardsSkeleton />}>
        <OverviewCards />
      </Suspense>
    </div>
  );
}
