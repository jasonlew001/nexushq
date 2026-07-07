import { Suspense } from "react";
import { requireFounder } from "@/lib/auth";
import { ActionStrip, ActionStripSkeleton } from "@/components/action-strip";
import { KpiRow, KpiRowSkeleton } from "@/components/kpi-row";
import { ThisWeekPanel, ThisWeekPanelSkeleton } from "@/components/overview/this-week-panel";
import { SystemStrip, SystemStripSkeleton } from "@/components/overview/system-strip";
import { OverviewCards, OverviewCardsSkeleton } from "@/components/overview-cards";

export const dynamic = "force-dynamic";

// The command-center home, top to bottom: what needs attention (action
// strip), the Hero grid (MRR + funnel), this week's activity, an ambient
// system strip, then the section cards that zoom into detail pages.
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

      <Suspense fallback={<ThisWeekPanelSkeleton />}>
        <ThisWeekPanel />
      </Suspense>

      <Suspense fallback={<SystemStripSkeleton />}>
        <SystemStrip />
      </Suspense>

      <Suspense fallback={<OverviewCardsSkeleton />}>
        <OverviewCards />
      </Suspense>
    </div>
  );
}
