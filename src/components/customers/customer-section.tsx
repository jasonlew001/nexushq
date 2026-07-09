import { Card, SectionLabel } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getCustomerRows, attachLifetimeRevenue, attachExportedAt } from "@/lib/data/customers";
import { getLifetimeRevenue } from "@/lib/data/stripe-metrics";
import { getExportedUsers } from "@/lib/data/exports";
import { CustomerTable } from "./customer-table";

export async function CustomerSection() {
  const [rows, revenue, exported] = await Promise.all([
    getCustomerRows(),
    getLifetimeRevenue(),
    // Degrade gracefully if migration 002 hasn't been run yet — the table
    // renders without export tracking rather than erroring the page.
    getExportedUsers().catch(() => new Map<string, string>()),
  ]);
  const enriched = attachExportedAt(attachLifetimeRevenue(rows, revenue.data), exported);

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
