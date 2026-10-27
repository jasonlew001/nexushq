import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton, ShellCard } from "@/components/ui/skeleton";
import { LiveDot } from "@/components/ui/live-dot";
import { Sparkline } from "./mrr-sparkline";
import { getVercelDeploys, getVercelErrors, getVercelTraffic, FAILED_STATES } from "@/lib/data/vercel-metrics";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";

// Overview's read on the main site: is it live, how many people came, and
// what shipped last. Alarms (failed push, errors today) also surface in the
// attention strip; this card is the steady-state view and links to /site.
export async function SiteSignal() {
  const [{ data: deploys }, { data: errors }, { data: traffic }] = await Promise.all([
    getVercelDeploys(),
    getVercelErrors(),
    getVercelTraffic(),
  ]);

  if (!deploys.connected) {
    return (
      <Link href="/site" className="group block h-full">
        <Card className="h-full p-5 transition-colors hover:border-edge-strong">
          <p className="text-sm font-medium">Main site</p>
          <p className="mt-1 text-xs text-faint">Connect Vercel to see deploys, errors and traffic.</p>
        </Card>
      </Link>
    );
  }

  const pendingFailed = deploys.pending != null && FAILED_STATES.has(deploys.pending.state);
  const building = deploys.pending != null && !pendingFailed;
  const errorsToday = errors.error ? null : errors.errorsToday;
  const tone = pendingFailed ? "danger" : building || (errorsToday ?? 0) > 0 ? "warn" : "accent";
  const status = pendingFailed
    ? "newest push didn't ship"
    : building
      ? "deploying"
      : (errorsToday ?? 0) > 0
        ? `live · ${errorsToday} error${errorsToday === 1 ? "" : "s"} today`
        : "live";

  const delta =
    traffic.visitorsPrev7d != null && traffic.visitorsPrev7d > 0
      ? (traffic.visitors7d - traffic.visitorsPrev7d) / traffic.visitorsPrev7d
      : null;

  return (
    <Link href="/site" className="group block h-full">
      <Card className="flex h-full flex-col overflow-hidden p-0 transition-colors hover:border-edge-strong">
        <div className="flex-1 p-5">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-medium">
              Main site
              <LiveDot tone={tone} />
              <span
                className={cn(
                  "text-xs font-normal",
                  tone === "danger" ? "text-danger" : tone === "warn" ? "text-warn" : "text-muted"
                )}
              >
                {status}
              </span>
            </p>
            <ArrowUpRight className="h-4 w-4 text-faint transition-colors group-hover:text-ink" />
          </div>

          {traffic.connected && !traffic.error ? (
            <>
              <p className="font-display mt-4 text-[40px] leading-[0.9]">{traffic.visitors7d.toLocaleString()}</p>
              <p className="mt-1.5 text-xs text-muted">
                visitors · 7 days
                {delta != null && (
                  <span className={cn("ml-2", delta >= 0 ? "text-accent" : "text-danger")}>
                    {delta >= 0 ? "▲" : "▼"} {Math.abs(delta * 100).toFixed(0)}%
                  </span>
                )}
              </p>
            </>
          ) : (
            <p className="mt-4 text-xs text-faint">Traffic unavailable right now.</p>
          )}

          {deploys.live && !deploys.error && (
            <p className="mt-3 truncate text-xs text-faint">
              <span className="font-mono text-muted">{deploys.live.sha ?? "deploy"}</span> shipped{" "}
              {formatRelativeTime(deploys.live.createdAt)} · {deploys.live.message ?? ""}
            </p>
          )}
        </div>
        {traffic.daily.length > 1 && (
          <Sparkline points={traffic.daily.map((d) => d.visitors)} colorVar="--accent" className="h-12" />
        )}
      </Card>
    </Link>
  );
}

export function SiteSignalSkeleton() {
  return (
    <ShellCard className="h-[220px] p-5">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-5 h-10 w-24" />
      <Skeleton className="mt-2 h-3 w-28" />
      <Skeleton className="mt-4 h-3 w-full" />
    </ShellCard>
  );
}
