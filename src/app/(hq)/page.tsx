import { Suspense } from "react";
import { requireFounder } from "@/lib/auth";
import { SectionBoundary } from "@/components/ui/section-boundary";
import { KpiRow, KpiRowSkeleton } from "@/components/kpi-row";
import { TrendRow, TrendRowSkeleton } from "@/components/overview/trend-row";
import { ActionStrip, ActionStripSkeleton } from "@/components/action-strip";
import { OverviewCards, OverviewCardsSkeleton } from "@/components/overview-cards";
import { SystemStrip, SystemStripSkeleton } from "@/components/overview/system-strip";
import { RequestsAlert, RequestsAlertSkeleton } from "@/components/overview/requests-alert";

export const dynamic = "force-dynamic";

// The Fieldra-style overview, top to bottom: 3 KPI cards, the big signups
// trend chart + breakdown panel, then attention + sections side by side,
// with an ambient system-status footer.
export default async function OverviewPage() {
  await requireFounder();

  return (
    <div className="space-y-6">
      <SectionBoundary label="KPIs">
        <Suspense fallback={<KpiRowSkeleton />}>
          <KpiRow />
        </Suspense>
      </SectionBoundary>

      <SectionBoundary label="Requests">
        <Suspense fallback={<RequestsAlertSkeleton />}>
          <RequestsAlert />
        </Suspense>
      </SectionBoundary>

      <SectionBoundary label="Signups">
        <Suspense fallback={<TrendRowSkeleton />}>
          <TrendRow />
        </Suspense>
      </SectionBoundary>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionBoundary label="Needs attention">
          <Suspense fallback={<ActionStripSkeleton />}>
            <ActionStrip />
          </Suspense>
        </SectionBoundary>

        <SectionBoundary label="Sections">
          <Suspense fallback={<OverviewCardsSkeleton />}>
            <OverviewCards />
          </Suspense>
        </SectionBoundary>
      </div>

      <SectionBoundary label="System status">
        <Suspense fallback={<SystemStripSkeleton />}>
          <SystemStrip />
        </Suspense>
      </SectionBoundary>
    </div>
  );
}
