import { Card, SectionLabel } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getCustomerRows, attachLifetimeRevenue } from "@/lib/data/customers";
import { getLifetimeRevenue } from "@/lib/data/stripe-metrics";
import { CustomerTable } from "./customer-table";

export async function CustomerSection() {
  const [rows, revenue] = await Promise.all([getCustomerRows(), getLifetimeRevenue()]);
  const enriched = attachLifetimeRevenue(rows, revenue.data);

  return (
    <Card>
      <SectionLabel>Customers</SectionLabel>
      <CustomerTable customers={enriched} />
    </Card>
  );
}

export function CustomerSectionSkeleton() {
  return (
    <div className="rounded-lg border border-edge bg-surface p-4">
      <Skeleton className="mb-3 h-3 w-24" />
      <Skeleton className="mb-3 h-8 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
