import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getInspoPage } from "@/lib/data/inspiration";
import type { InspoFilters } from "@/lib/inspiration-filters";
import { InspirationLibrary } from "./inspiration-library";

export async function InspirationPanel({
  filters,
  currentUserId,
}: {
  filters: InspoFilters;
  currentUserId: string;
}) {
  const data = await getInspoPage(filters, currentUserId);

  return (
    <Card>
      <InspirationLibrary filters={filters} data={data} currentUserId={currentUserId} />
    </Card>
  );
}

export function InspirationPanelSkeleton() {
  return (
    <div className="rounded-lg border border-edge bg-surface p-4">
      <Skeleton className="mb-4 h-8 w-full" />
      <Skeleton className="mb-2.5 h-8 w-full" />
      <Skeleton className="mb-4 h-5 w-2/3" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
