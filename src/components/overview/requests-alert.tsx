import Link from "next/link";
import { Inbox, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LiveDot } from "@/components/ui/live-dot";
import { getContactRequests } from "@/lib/data/requests";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";

// Overview's "you have mail" banner. Outlined in red only while something is
// unhandled, so a clear queue reads as calm rather than as another alert.
// Reuses getContactRequests() (request-cached) instead of the lighter count
// query, because it also wants the newest submission's timestamp.
export async function RequestsAlert() {
  const { requests } = await getContactRequests();
  const unhandled = requests.filter((r) => r.status === "new");
  const count = unhandled.length;
  const newest = unhandled[0] ?? requests[0];

  return (
    <Link href="/requests" className="group block">
      <Card
        className={cn(
          "flex items-center gap-3 transition-colors",
          count > 0
            ? "border-danger/40 ring-1 ring-danger/30 hover:border-danger/60"
            : "hover:border-edge-strong"
        )}
      >
        <span
          className={cn(
            "shrink-0 rounded-md p-1.5 transition-colors",
            count > 0 ? "bg-danger/10" : "bg-surface-2"
          )}
        >
          <Inbox
            className={cn("h-4 w-4", count > 0 ? "text-danger" : "text-muted")}
            strokeWidth={1.75}
          />
        </span>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-medium">
            Requests
            {count > 0 ? (
              <span className="tnum inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1.5 text-[10px] font-semibold text-white">
                {count > 99 ? "99+" : count}
              </span>
            ) : null}
          </p>
          <p className="truncate text-xs text-faint">
            {count > 0
              ? `${count} unanswered · newest ${newest ? formatRelativeTime(newest.createdAt) : "—"}`
              : requests.length > 0
                ? `all ${requests.length} handled · contact form inbox`
                : "contact form inbox"}
          </p>
        </div>

        {count > 0 ? (
          <span className="shrink-0">
            <LiveDot tone="danger" />
          </span>
        ) : null}
        <ChevronRight className="h-4 w-4 shrink-0 text-faint opacity-0 transition-opacity group-hover:opacity-100" />
      </Card>
    </Link>
  );
}

export function RequestsAlertSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-edge bg-surface p-4">
      <Skeleton className="h-7 w-7 rounded-md" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-48" />
      </div>
    </div>
  );
}
