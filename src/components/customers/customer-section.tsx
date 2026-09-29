import { Card, SectionLabel } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getCustomerRows,
  attachLifetimeRevenue,
  attachExportedAt,
  attachComped,
} from "@/lib/data/customers";
import { getLifetimeRevenue, getStripeMetrics } from "@/lib/data/stripe-metrics";
import { getExportedUsers } from "@/lib/data/exports";
import { CustomerTable } from "./customer-table";

export async function CustomerSection() {
  const [rows, revenue, stripe, exported] = await Promise.all([
    getCustomerRows(),
    getLifetimeRevenue(),
    // Only needed for the comped flag — already cached/tagged, so this is a
    // shared read rather than an extra Stripe walk on most renders. If
    // Stripe is unreachable, the table still renders, just unflagged.
    getStripeMetrics().then((r) => r.data.compedCustomerIds).catch(() => [] as string[]),
    // Degrade gracefully if migration 002 hasn't been run yet — the table
    // renders without export tracking rather than erroring the page.
    getExportedUsers().catch(() => new Map<string, string>()),
  ]);
  const enriched = attachComped(
    attachExportedAt(attachLifetimeRevenue(rows, revenue.data), exported),
    stripe
  );

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
