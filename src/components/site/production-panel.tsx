import { ExternalLink, Loader2, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton, ShellCard } from "@/components/ui/skeleton";
import { LiveDot } from "@/components/ui/live-dot";
import { DeployHistoryChart } from "@/components/charts/deploy-history-chart";
import { getVercelDeploys, getVercelConfig, FAILED_STATES } from "@/lib/data/vercel-metrics";
import { formatDuration, formatRelativeTime } from "@/lib/format";
import { VercelNotConnected, VercelUnavailable } from "./vercel-states";

function Stat({ label, value, tone }: { label: string; value: string; tone?: "danger" }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className={`tnum mt-1 text-lg font-semibold leading-none ${tone === "danger" ? "text-danger" : ""}`}>
        {value}
      </p>
    </div>
  );
}

// What's live on the main site right now, whether a newer push is building
// or failed, and the last 40 production deploys as a build-time strip.
export async function ProductionPanel() {
  const [{ data }, { data: config }] = await Promise.all([getVercelDeploys(), getVercelConfig()]);

  if (!data.connected) return <VercelNotConnected />;
  if (data.error) return <VercelUnavailable title="Production deploys" message={data.error} />;

  const { live, pending } = data;
  const domain = config.domains.find((d) => !d.redirectTo && !d.name.endsWith(".vercel.app"))?.name;
  const commitUrl = (sha: string | null) => (data.repoUrl && sha ? `${data.repoUrl}/commit/${sha}` : null);
  const pendingFailed = pending != null && FAILED_STATES.has(pending.state);

  return (
    <Card className="p-0">
      <div className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-medium">
            <LiveDot tone={pendingFailed ? "warn" : "accent"} />
            Live
            {domain && (
              <a
                href={`https://${domain}`}
                target="_blank"
                rel="noreferrer"
                className="font-normal text-muted hover:text-ink hover:underline"
              >
                {domain}
              </a>
            )}
          </p>
          {live?.inspectorUrl && (
            <a
              href={live.inspectorUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink"
            >
              Open in Vercel <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        {live ? (
          <>
            <p className="mt-3 line-clamp-2 text-base font-medium leading-snug [text-wrap:balance]">
              {live.message ?? "Manual deploy"}
            </p>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
              {live.sha &&
                (commitUrl(live.sha) ? (
                  <a href={commitUrl(live.sha)!} target="_blank" rel="noreferrer" className="font-mono hover:text-ink hover:underline">
                    {live.sha}
                  </a>
                ) : (
                  <span className="font-mono">{live.sha}</span>
                ))}
              <span className="text-faint">·</span>
              <span>shipped {formatRelativeTime(live.createdAt)}</span>
              {live.buildSeconds != null && (
                <>
                  <span className="text-faint">·</span>
                  <span className="tnum">built in {formatDuration(live.buildSeconds)}</span>
                </>
              )}
            </p>
          </>
        ) : (
          <p className="mt-3 text-sm text-muted">No ready production deployment in the last 100.</p>
        )}

        {pending && (
          <div
            className={`mt-3 flex items-start gap-2 rounded-md px-3 py-2 text-xs ${
              pendingFailed ? "bg-danger/10 text-danger" : "bg-surface-2 text-muted"
            }`}
          >
            {pendingFailed ? (
              <XCircle className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            ) : (
              <Loader2 className="mt-px h-3.5 w-3.5 shrink-0 motion-safe:animate-spin" strokeWidth={2} />
            )}
            <span className="min-w-0">
              <span className="font-medium">
                {pendingFailed ? `Newest push ${pending.state === "ERROR" ? "failed to build" : pending.state.toLowerCase()}` : "Building a newer push"}
              </span>
              {" · "}
              <span className="font-mono">{pending.sha ?? "manual"}</span> {pending.message ?? ""}
              {pending.errorMessage && <span className="mt-0.5 block opacity-90">{pending.errorMessage}</span>}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 border-t border-edge px-4 py-3">
        <Stat label="Deploys · 7 days" value={String(data.deploysLast7d)} />
        <Stat
          label="Failed or blocked · 7 days"
          value={String(data.failedLast7d)}
          tone={data.failedLast7d > 0 ? "danger" : undefined}
        />
        <Stat
          label="Median build"
          value={data.medianBuildSeconds != null ? formatDuration(data.medianBuildSeconds) : "—"}
        />
      </div>

      <div className="border-t border-edge p-4">
        <DeployHistoryChart history={data.history} />
      </div>
    </Card>
  );
}

export function ProductionPanelSkeleton() {
  return (
    <ShellCard className="h-[392px]">
      <Skeleton className="h-4 w-56" />
      <Skeleton className="mt-4 h-5 w-3/4" />
      <Skeleton className="mt-2 h-3 w-64" />
      <Skeleton className="mt-8 h-10 w-full" />
      <Skeleton className="mt-6 h-[140px] w-full" />
    </ShellCard>
  );
}
