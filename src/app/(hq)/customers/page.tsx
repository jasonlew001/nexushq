import { Suspense } from "react";
import { requireFounder } from "@/lib/auth";
import { SectionBoundary } from "@/components/ui/section-boundary";
import { PageShell } from "@/components/page-shell";
import { CustomerSection, CustomerSectionSkeleton } from "@/components/customers/customer-section";
import {
  HearAboutUsPanel,
  HearAboutUsPanelSkeleton,
} from "@/components/customers/hear-about-us-panel";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  await requireFounder();

  return (
    <PageShell
      title="Customers"
      description="Every account — search, filter, click a row for payment history"
    >
      <div className="mb-4">
        <SectionBoundary label="How they heard about us">
          <Suspense fallback={<HearAboutUsPanelSkeleton />}>
            <HearAboutUsPanel />
          </Suspense>
        </SectionBoundary>
      </div>

      <SectionBoundary label="Customers">
        <Suspense fallback={<CustomerSectionSkeleton />}>
          <CustomerSection />
        </Suspense>
      </SectionBoundary>
    </PageShell>
  );
}
