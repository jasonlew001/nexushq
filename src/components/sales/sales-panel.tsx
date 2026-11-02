import { Card, SectionLabel } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getSalesData } from "@/lib/data/sales";
import { PayoutsCard } from "./payouts-card";
import { ClaimsCard } from "./claims-card";
import { RepsCard } from "./reps-card";

export async function SalesPanel() {
  const { available, reps, claims, payouts } = await getSalesData();

  if (!available) {
    return (
      <Card>
        <SectionLabel>Sales</SectionLabel>
        <p className="text-xs text-faint">
          Rep tracking is off until sql/012_sales_reps.sql is run in the Supabase SQL Editor.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <PayoutsCard reps={reps} claims={claims} payouts={payouts} />
      <ClaimsCard reps={reps} claims={claims} />
      <RepsCard reps={reps} />
    </div>
  );
}

export function SalesPanelSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1].map((i) => (
        <div key={i} className="rounded-lg border border-edge bg-surface p-4">
          <Skeleton className="mb-3 h-3 w-24" />
          <Skeleton className="mb-3 h-8 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ))}
    </div>
  );
}
