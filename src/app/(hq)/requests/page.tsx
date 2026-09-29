import { Suspense } from "react";
import { requireFounder } from "@/lib/auth";
import { SectionBoundary } from "@/components/ui/section-boundary";
import { PageShell } from "@/components/page-shell";
import { RequestsPanel, RequestsPanelSkeleton } from "@/components/requests/requests-panel";

export const dynamic = "force-dynamic";

export default async function RequestsPage() {
  await requireFounder();

  return (
    <PageShell
      title="Requests"
      description="Contact form submissions from the main site, with status and internal notes"
    >
      <SectionBoundary label="Requests">
        <Suspense fallback={<RequestsPanelSkeleton />}>
          <RequestsPanel />
        </Suspense>
      </SectionBoundary>
    </PageShell>
  );
}
