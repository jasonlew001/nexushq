import { CheckCircle2, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton, ShellCard } from "@/components/ui/skeleton";
import { getVercelDeploys } from "@/lib/data/vercel-metrics";
import { formatRelativeTime } from "@/lib/format";

const STATE_BADGE: Record<string, { tone: "danger" | "warn"; label: string }> = {
  ERROR: { tone: "danger", label: "Build failed" },
  BLOCKED: { tone: "warn", label: "Blocked" },
  CANCELED: { tone: "warn", label: "Canceled" },
};

// Pushes that never reached production, with Vercel's own reason. BLOCKED
// is the sneaky one: the commit author lacked deploy permission, so the push
// silently never shipped.
export async function DeployFailures() {
  const { data } = await getVercelDeploys();
  // Connection/error states are already shown by the production panel.
  if (!data.connected || data.error) return null;

  return (
    <Card className="p-0">
      <div className="flex items-baseline justify-between border-b border-edge px-4 py-3">
        <p className="text-sm font-medium">Pushes that didn&apos;t ship</p>
        <p className="text-xs text-faint">last 100 production deploys</p>
      </div>

      {data.failures.length === 0 ? (
        <div className="flex items-center gap-2 px-4 py-4 text-sm text-muted">
          <CheckCircle2 className="h-4 w-4 text-accent" strokeWidth={1.75} />
          Every production push built and shipped.
        </div>
      ) : (
        // Capped to roughly the production panel's height; older ones scroll.
        <ul className="max-h-[330px] divide-y divide-edge overflow-y-auto">
          {data.failures.map((f) => {
            const badge = STATE_BADGE[f.state] ?? { tone: "warn" as const, label: f.state };
            return (
              <li key={f.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Badge tone={badge.tone}>{badge.label}</Badge>
                  <span className="font-mono text-xs text-muted">{f.sha ?? "manual"}</span>
                  <span className="min-w-0 flex-1 truncate text-xs">{f.message ?? ""}</span>
                  <span className="shrink-0 text-xs text-faint">{formatRelativeTime(f.createdAt)}</span>
                  {f.inspectorUrl && (
                    <a
                      href={f.inspectorUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Open build in Vercel"
                      className="shrink-0 text-faint hover:text-ink"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
                {f.errorMessage && <p className="mt-1 text-xs leading-relaxed text-muted">{f.errorMessage}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export function DeployFailuresSkeleton() {
  return (
    <ShellCard className="h-[240px]">
      <Skeleton className="h-4 w-40" />
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="mt-4 h-8 w-full" />
      ))}
    </ShellCard>
  );
}
