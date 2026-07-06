import { Suspense } from "react";
import { requireFounder } from "@/lib/auth";
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
      <Suspense fallback={<CustomerSectionSkeleton />}>
        <CustomerSection />
      </Suspense>
    </PageShell>
  );
}
