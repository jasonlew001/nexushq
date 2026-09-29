import { Suspense } from "react";
import { requireFounder } from "@/lib/auth";
import { SectionBoundary } from "@/components/ui/section-boundary";
import { PageShell } from "@/components/page-shell";
import { CustomerSection, CustomerSectionSkeleton } from "@/components/customers/customer-section";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  await requireFounder();

  return (
    <PageShell
      title="Customers"
      description="Every account — search, filter, click a row for payment history"
    >
      <SectionBoundary label="Customers">
        <Suspense fallback={<CustomerSectionSkeleton />}>
          <CustomerSection />
        </Suspense>
      </SectionBoundary>
    </PageShell>
  );
}
