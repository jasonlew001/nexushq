import { Suspense } from "react";
import { requireFounder } from "@/lib/auth";
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
      <Suspense fallback={<RequestsPanelSkeleton />}>
        <RequestsPanel />
      </Suspense>
    </PageShell>
  );
}
