import { Suspense } from "react";
import { requireFounder } from "@/lib/auth";
import { SectionBoundary } from "@/components/ui/section-boundary";
import { PageShell } from "@/components/page-shell";
import {
  InspirationPanel,
  InspirationPanelSkeleton,
} from "@/components/inspiration/inspiration-panel";
import { parseInspoFilters } from "@/lib/inspiration-filters";
import { InspirationSwitcher } from "@/components/inspiration/inspiration-switcher";

export const dynamic = "force-dynamic";

export default async function InspirationPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const founder = await requireFounder();
  const filters = parseInspoFilters(searchParams);

  return (
    <PageShell
      title="Inspiration"
      description="Viral golf and recruiting reels and slideshows — sorted by what outperformed its creator's audience"
    >
      <InspirationSwitcher active="library" />
      <SectionBoundary label="Inspiration">
        <Suspense fallback={<InspirationPanelSkeleton />}>
          <InspirationPanel filters={filters} currentUserId={founder.userId} />
        </Suspense>
      </SectionBoundary>
    </PageShell>
  );
}
