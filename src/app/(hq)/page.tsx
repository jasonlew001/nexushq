import { Suspense } from "react";
import { requireFounder } from "@/lib/auth";
import { SectionBoundary } from "@/components/ui/section-boundary";
import { KpiRow, KpiRowSkeleton } from "@/components/kpi-row";
import { TrendRow, TrendRowSkeleton } from "@/components/overview/trend-row";
import { ActionStrip, ActionStripSkeleton } from "@/components/action-strip";
import { OverviewCards, OverviewCardsSkeleton } from "@/components/overview-cards";
import { SystemStrip, SystemStripSkeleton } from "@/components/overview/system-strip";
import { RequestsAlert, RequestsAlertSkeleton } from "@/components/overview/requests-alert";
import { HearAboutUsPanel, HearAboutUsPanelSkeleton } from "@/components/customers/hear-about-us-panel";
import { SiteSignal, SiteSignalSkeleton } from "@/components/overview/site-signal";

export const dynamic = "force-dynamic";

// The Fieldra-style overview, top to bottom: 3 KPI cards, the big signups
// trend chart + breakdown panel, then attention + sections + hear-about-us
// side by side, with an ambient system-status footer.
export default async function OverviewPage() {
  await requireFounder();

  return (
    <div className="space-y-6">
      <SectionBoundary label="KPIs">
        <Suspense fallback={<KpiRowSkeleton />}>
          <KpiRow />
        </Suspense>
      </SectionBoundary>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionBoundary label="Requests">
          <Suspense fallback={<RequestsAlertSkeleton />}>
            <RequestsAlert />
          </Suspense>
        </SectionBoundary>

        <SectionBoundary label="Site">
          <Suspense fallback={<SiteSignalSkeleton />}>
            <SiteSignal />
          </Suspense>
        </SectionBoundary>
      </div>

      <SectionBoundary label="Signups">
        <Suspense fallback={<TrendRowSkeleton />}>
          <TrendRow />
        </Suspense>
      </SectionBoundary>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
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

        <SectionBoundary label="How they heard about us">
          <Suspense fallback={<HearAboutUsPanelSkeleton />}>
            <HearAboutUsPanel />
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
