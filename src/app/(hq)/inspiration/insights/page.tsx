import { Suspense } from "react";
import { requireFounder } from "@/lib/auth";
import { SectionBoundary } from "@/components/ui/section-boundary";
import { PageShell } from "@/components/page-shell";
import { InspirationSwitcher } from "@/components/inspiration/inspiration-switcher";
import { InsightsPanel, InsightsPanelSkeleton } from "@/components/inspiration/insights-panel";
import { parseInsightsFilters } from "@/lib/data/inspiration-insights";

export const dynamic = "force-dynamic";

export default async function InspirationInsightsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  await requireFounder();
  const filters = parseInsightsFilters(searchParams);

  return (
    <PageShell
      title="Inspiration"
      description="Which themes, hooks and formats work across many creators, so they're worth running for Nexus"
    >
      <InspirationSwitcher active="insights" />
      <SectionBoundary label="Insights">
        <Suspense fallback={<InsightsPanelSkeleton />}>
          <InsightsPanel filters={filters} />
        </Suspense>
      </SectionBoundary>
    </PageShell>
  );
}
