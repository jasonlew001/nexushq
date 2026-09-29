import { Card, SectionLabel } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getContactRequests } from "@/lib/data/requests";
import { RequestsList } from "./requests-list";

export async function RequestsPanel() {
  const { requests, triageAvailable } = await getContactRequests();

  return (
    <Card>
      <SectionLabel>Contact form</SectionLabel>
      <RequestsList requests={requests} triageAvailable={triageAvailable} />
    </Card>
  );
}

export function RequestsPanelSkeleton() {
  return (
    <div className="rounded-lg border border-edge bg-surface p-4">
      <Skeleton className="mb-3 h-3 w-24" />
      <Skeleton className="mb-3 h-7 w-72" />
      <Skeleton className="mb-3 h-8 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
