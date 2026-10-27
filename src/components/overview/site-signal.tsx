import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton, ShellCard } from "@/components/ui/skeleton";
import { LiveDot } from "@/components/ui/live-dot";
import { MiniBars } from "./mrr-sparkline";
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
      <Card className="flex h-full flex-col p-5 transition-colors hover:border-edge-strong">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold">Main site</p>
          <span className="flex items-center gap-1.5 text-xs">
            <LiveDot tone={tone} />
            <span className={cn(tone === "danger" ? "text-danger" : tone === "warn" ? "text-warn" : "text-muted")}>
              {status}
            </span>
            <ArrowUpRight className="ml-1 h-3.5 w-3.5 text-faint transition-colors group-hover:text-ink" />
          </span>
        </div>

        {traffic.connected && !traffic.error ? (
          <>
            <div className="mt-4 flex items-baseline gap-2.5">
              <p className="font-display text-[34px] leading-none">{traffic.visitors7d.toLocaleString()}</p>
              {delta != null && (
                <span
                  className={cn(
                    "tnum whitespace-nowrap rounded-full px-1.5 py-0.5 text-xs font-medium",
                    delta >= 0 ? "bg-accent/10 text-accent" : "bg-danger/10 text-danger"
                  )}
                >
                  {delta >= 0 ? "↑" : "↓"} {Math.abs(delta * 100).toFixed(0)}%
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted">Visitors, last 7 days</p>
            {/* 30 daily bars fill whatever height the row gives this card. */}
            <div className="mt-4 flex min-h-[72px] flex-1 flex-col justify-end">
              <MiniBars points={traffic.daily.map((d) => d.visitors)} colorVar="--accent" className="h-full max-h-[120px] min-h-[72px]" />
            </div>
          </>
        ) : (
          <p className="mt-4 flex-1 text-xs text-faint">Traffic unavailable right now.</p>
        )}

        {deploys.live && !deploys.error && (
          <p className="mt-3 truncate border-t border-edge pt-3 text-xs text-faint">
            <span className="font-mono text-muted">{deploys.live.sha ?? "deploy"}</span> shipped{" "}
            {formatRelativeTime(deploys.live.createdAt)} · {deploys.live.message ?? ""}
          </p>
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
