import Link from "next/link";
import { Globe, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LiveDot } from "@/components/ui/live-dot";
import { getVercelDeploys, getVercelErrors, getVercelTraffic, FAILED_STATES } from "@/lib/data/vercel-metrics";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";

// Overview's one-line read on the main site, styled like RequestsAlert: calm
// when healthy, outlined red when the newest push failed or production is
// throwing 5xx today. Links to /site for the detail.
export async function SiteSignal() {
  const [{ data: deploys }, { data: errors }, { data: traffic }] = await Promise.all([
    getVercelDeploys(),
    getVercelErrors(),
    getVercelTraffic(),
  ]);

  if (!deploys.connected) {
    return (
      <Link href="/site" className="group block h-full">
        <Card className="flex h-full items-center gap-3 transition-colors hover:border-edge-strong">
          <span className="shrink-0 rounded-md bg-surface-2 p-1.5">
            <Globe className="h-4 w-4 text-muted" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Site</p>
            <p className="truncate text-xs text-faint">Connect Vercel to see deploys and errors</p>
          </div>
          <ChevronRight className="h-4 w-4 text-faint" />
        </Card>
      </Link>
    );
  }

  const pendingFailed = deploys.pending != null && FAILED_STATES.has(deploys.pending.state);
  const building = deploys.pending != null && !pendingFailed;
  const errorsToday = errors.error ? null : errors.errorsToday;
  const alarm = pendingFailed || (errorsToday ?? 0) > 0;

  const parts: string[] = [];
  if (deploys.error) {
    parts.push("deploy status unavailable");
  } else if (pendingFailed) {
    parts.push(`newest push ${deploys.pending!.state === "ERROR" ? "failed to build" : deploys.pending!.state.toLowerCase()}`);
  } else if (building) {
    parts.push("building a new push");
  } else if (deploys.live) {
    parts.push(`${deploys.live.sha ?? "deploy"} shipped ${formatRelativeTime(deploys.live.createdAt)}`);
  }
  if (errorsToday != null) parts.push(`${errorsToday} server error${errorsToday === 1 ? "" : "s"} today`);
  if (!traffic.error && traffic.connected) parts.push(`${traffic.visitors7d.toLocaleString()} visitors · 7d`);

  return (
    <Link href="/site" className="group block h-full">
      <Card
        className={cn(
          "flex h-full items-center gap-3 transition-colors",
          alarm ? "border-danger/40 ring-1 ring-danger/30 hover:border-danger/60" : "hover:border-edge-strong"
        )}
      >
        <span className={cn("shrink-0 rounded-md p-1.5", alarm ? "bg-danger/10" : "bg-surface-2")}>
          <Globe className={cn("h-4 w-4", alarm ? "text-danger" : "text-muted")} strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-medium">
            Site
            <LiveDot tone={alarm ? "danger" : building ? "warn" : "accent"} />
            <span className="text-xs font-normal text-muted">
              {alarm ? "needs a look" : building ? "deploying" : "live"}
            </span>
          </p>
          <p className="truncate text-xs text-faint">{parts.join(" · ")}</p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-faint opacity-0 transition-opacity group-hover:opacity-100" />
      </Card>
    </Link>
  );
}

export function SiteSignalSkeleton() {
  return (
    <Card className="flex h-full items-center gap-3">
      <Skeleton className="h-7 w-7 rounded-md" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-56" />
      </div>
    </Card>
  );
}
