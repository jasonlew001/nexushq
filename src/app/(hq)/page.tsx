import { Suspense } from "react";
import { requireFounder } from "@/lib/auth";
import { SectionBoundary } from "@/components/ui/section-boundary";
import { PageTitle } from "@/components/page-shell";
import { KpiRow, KpiRowSkeleton } from "@/components/kpi-row";
import { TrendRow, TrendRowSkeleton } from "@/components/overview/trend-row";
import { AttentionStrip, AttentionStripSkeleton } from "@/components/overview/attention-strip";
import { SystemStrip, SystemStripSkeleton } from "@/components/overview/system-strip";
import { HearAboutUsPanel, HearAboutUsPanelSkeleton } from "@/components/customers/hear-about-us-panel";
import { SiteSignal, SiteSignalSkeleton } from "@/components/overview/site-signal";
import { InstagramCard } from "@/components/overview/instagram-card";
import { CardSkeleton } from "@/components/ui/skeleton";

export const dynamic = "force-dynamic";

// Overview, top to bottom, in the order a founder asks the questions:
// how is the business doing (pulse band), what needs me (attention strip),
// is it growing (signups + conversion), and how are the channels doing
// (main site, Instagram, how payers heard about us). Ambient footer last.
export default async function OverviewPage() {
  await requireFounder();

  return (
    <div className="stagger space-y-5">
      <PageTitle title="Welcome back" />

      <SectionBoundary label="KPIs">
        <Suspense fallback={<KpiRowSkeleton />}>
          <KpiRow />
        </Suspense>
      </SectionBoundary>

      <SectionBoundary label="Needs attention">
        <Suspense fallback={<AttentionStripSkeleton />}>
          <AttentionStrip />
        </Suspense>
      </SectionBoundary>

      <SectionBoundary label="Signups">
        <Suspense fallback={<TrendRowSkeleton />}>
          <TrendRow />
        </Suspense>
      </SectionBoundary>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionBoundary label="Main site">
          <Suspense fallback={<SiteSignalSkeleton />}>
            <SiteSignal />
          </Suspense>
        </SectionBoundary>

        <SectionBoundary label="Instagram">
          <Suspense fallback={<CardSkeleton className="h-[220px]" />}>
            <InstagramCard />
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
