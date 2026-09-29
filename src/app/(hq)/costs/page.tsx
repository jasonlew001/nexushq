import { Suspense } from "react";
import { requireFounder } from "@/lib/auth";
import { SectionBoundary } from "@/components/ui/section-boundary";
import { PageShell } from "@/components/page-shell";
import { CostsPanel, CostsPanelSkeleton } from "@/components/costs/costs-panel";

export const dynamic = "force-dynamic";

export default async function CostsPage() {
  await requireFounder();

  return (
    <PageShell
      title="Costs"
      description="Live Anthropic API spend plus manually tracked fixed costs"
    >
      <SectionBoundary label="Costs">
        <Suspense fallback={<CostsPanelSkeleton />}>
          <CostsPanel />
        </Suspense>
      </SectionBoundary>
    </PageShell>
  );
}
