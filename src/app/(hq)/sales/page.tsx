import { Suspense } from "react";
import { requireFounder } from "@/lib/auth";
import { SectionBoundary } from "@/components/ui/section-boundary";
import { PageShell } from "@/components/page-shell";
import { SalesPanel, SalesPanelSkeleton } from "@/components/sales/sales-panel";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  await requireFounder();

  return (
    <PageShell
      title="Sales"
      description="Rep claims matched to real payments, commissions, and month-end payouts"
    >
      <SectionBoundary label="Sales">
        <Suspense fallback={<SalesPanelSkeleton />}>
          <SalesPanel />
        </Suspense>
      </SectionBoundary>
    </PageShell>
  );
}
