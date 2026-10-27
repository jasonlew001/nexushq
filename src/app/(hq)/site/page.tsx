import { Suspense } from "react";
import { requireFounder } from "@/lib/auth";
import { SectionBoundary } from "@/components/ui/section-boundary";
import { PageShell } from "@/components/page-shell";
import { ProductionPanel, ProductionPanelSkeleton } from "@/components/site/production-panel";
import { DeployFailures, DeployFailuresSkeleton } from "@/components/site/deploy-failures";
import { RouteErrorsPanel, RouteErrorsPanelSkeleton } from "@/components/site/route-errors-panel";
import { TrafficPanel, TrafficPanelSkeleton } from "@/components/site/traffic-panel";
import { EnvPanel, DomainsPanel, ConfigPanelSkeleton } from "@/components/site/config-panel";

export const dynamic = "force-dynamic";

// The main site (nexusgolfrecruiting.com) as Vercel sees it. Each panel
// suspends on its own: the observability query behind the errors table
// takes several seconds and must not hold up the deploy status.
export default async function SitePage() {
  await requireFounder();

  return (
    <PageShell title="Site" description="nexusgolfrecruiting.com on Vercel: deploys, errors, traffic and config">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <SectionBoundary label="Production">
              <Suspense fallback={<ProductionPanelSkeleton />}>
                <ProductionPanel />
              </Suspense>
            </SectionBoundary>
          </div>
          <div className="lg:col-span-2">
            <SectionBoundary label="Failed deploys">
              <Suspense fallback={<DeployFailuresSkeleton />}>
                <DeployFailures />
              </Suspense>
            </SectionBoundary>
          </div>
        </div>

        <SectionBoundary label="Server errors">
          <Suspense fallback={<RouteErrorsPanelSkeleton />}>
            <RouteErrorsPanel />
          </Suspense>
        </SectionBoundary>

        <SectionBoundary label="Site traffic">
          <Suspense fallback={<TrafficPanelSkeleton />}>
            <TrafficPanel />
          </Suspense>
        </SectionBoundary>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <SectionBoundary label="Environment variables">
              <Suspense fallback={<ConfigPanelSkeleton className="h-[420px]" />}>
                <EnvPanel />
              </Suspense>
            </SectionBoundary>
          </div>
          <div className="lg:col-span-2">
            <SectionBoundary label="Domains">
              <Suspense fallback={<ConfigPanelSkeleton />}>
                <DomainsPanel />
              </Suspense>
            </SectionBoundary>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
