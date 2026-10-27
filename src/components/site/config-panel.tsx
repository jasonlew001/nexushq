import { AlertTriangle, CheckCircle2, Globe, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton, ShellCard } from "@/components/ui/skeleton";
import { getVercelConfig, type Environment } from "@/lib/data/vercel-metrics";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { VercelUnavailable } from "./vercel-states";

const ENV_SHORT: Record<Environment, string> = {
  production: "Prod",
  preview: "Preview",
  development: "Dev",
};
const ENVS: Environment[] = ["production", "preview", "development"];

// Main-site env vars by NAME only. HQ never requests values (the project
// endpoint returns them encrypted anyway, and they're dropped on read).
export async function EnvPanel() {
  const { data } = await getVercelConfig();

  if (!data.connected) return null;
  if (data.error) return <VercelUnavailable title="Environment variables" message={data.error} />;

  const flagged = new Map<string, { tone: "danger" | "warn"; message: string }[]>();
  for (const f of data.envFlags) flagged.set(f.key, [...(flagged.get(f.key) ?? []), f]);

  return (
    <Card className="p-0">
      <div className="flex items-baseline justify-between border-b border-edge px-4 py-3">
        <p className="text-sm font-medium">Environment variables</p>
        <p className="text-xs text-faint">{data.env.length} on the main site · names only</p>
      </div>

      {data.envFlags.length === 0 ? (
        <div className="flex items-center gap-2 border-b border-edge px-4 py-3 text-xs text-muted">
          <CheckCircle2 className="h-4 w-4 text-accent" strokeWidth={1.75} />
          No exposed secrets, and related vars agree on environments.
        </div>
      ) : (
        <ul className="divide-y divide-edge border-b border-edge">
          {data.envFlags.map((f, i) => (
            <li key={`${f.key}-${i}`} className="flex items-start gap-2.5 px-4 py-2.5">
              {f.tone === "danger" ? (
                <ShieldAlert className="mt-px h-4 w-4 shrink-0 text-danger" strokeWidth={1.75} />
              ) : (
                <AlertTriangle className="mt-px h-4 w-4 shrink-0 text-warn" strokeWidth={1.75} />
              )}
              <p className="min-w-0 text-xs leading-relaxed">
                <span className="font-mono font-medium">{f.key}</span>{" "}
                <span className="text-muted">{f.message}</span>
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-faint">
              <th className="px-4 py-2 font-normal">Name</th>
              {ENVS.map((e) => (
                <th key={e} className="px-2 py-2 text-center font-normal">
                  {ENV_SHORT[e]}
                </th>
              ))}
              <th className="px-2 py-2 font-normal">Type</th>
              <th className="px-4 py-2 text-right font-normal">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge">
            {data.env.map((v) => {
              const flags = flagged.get(v.key);
              return (
                <tr key={v.key}>
                  <td
                    className={cn(
                      "px-4 py-1.5 font-mono text-[11.5px]",
                      flags?.some((f) => f.tone === "danger")
                        ? "text-danger"
                        : flags
                          ? "text-warn"
                          : ""
                    )}
                  >
                    {v.key}
                  </td>
                  {ENVS.map((e) => (
                    <td key={e} className="px-2 py-1.5 text-center">
                      {v.targets.includes(e) ? (
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-ink/70" aria-label="set" />
                      ) : (
                        <span className="text-faint" aria-label="not set">
                          ·
                        </span>
                      )}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-muted">{v.type}</td>
                  <td className="tnum px-4 py-1.5 text-right text-faint">
                    {v.updatedAt ? formatDate(v.updatedAt) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// Domains attached to the main-site project: DNS config, and registration
// expiry for the ones bought through Vercel.
export async function DomainsPanel() {
  const { data } = await getVercelConfig();

  if (!data.connected || data.error) return null; // EnvPanel already reports the error

  return (
    <Card className="p-0">
      <div className="flex items-baseline justify-between border-b border-edge px-4 py-3">
        <p className="text-sm font-medium">Domains</p>
        <p className="flex gap-2 text-xs text-faint">
          <span>Web Analytics {data.webAnalyticsOn ? "on" : "off"}</span>
          <span>·</span>
          <span>Speed Insights {data.speedInsightsOn ? "on" : "off"}</span>
        </p>
      </div>
      <ul className="divide-y divide-edge">
        {data.domains.map((d) => {
          const healthy = d.verified && d.misconfigured !== true;
          return (
            <li key={d.name} className="flex items-start gap-2.5 px-4 py-3">
              <Globe className={cn("mt-px h-4 w-4 shrink-0", healthy ? "text-accent" : "text-danger")} strokeWidth={1.75} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{d.name}</span>
                  {d.redirectTo ? (
                    <span className="text-xs text-faint">redirects to {d.redirectTo}</span>
                  ) : healthy ? (
                    <Badge tone="accent">DNS ok</Badge>
                  ) : (
                    <Badge tone="danger">{d.verified ? "Misconfigured" : "Unverified"}</Badge>
                  )}
                  {d.expiringSoon && <Badge tone="warn">Expiring soon</Badge>}
                </p>
                {!d.redirectTo && (d.nameservers.length > 0 || d.expiresAt) && (
                  <p className="mt-0.5 text-xs text-muted">
                    {d.nameservers.length > 0 && <span>Nameservers {d.nameservers.join(", ")}</span>}
                    {d.expiresAt && (
                      <span>
                        {d.nameservers.length > 0 ? " · " : ""}
                        {d.autoRenew === true
                          ? `Auto-renews ${formatDate(d.expiresAt)}`
                          : `Expires ${formatDate(d.expiresAt)}${d.autoRenew === false ? " (auto-renew off)" : ""}`}
                      </span>
                    )}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export function ConfigPanelSkeleton({ className }: { className?: string }) {
  return (
    <ShellCard className={className ?? "h-[200px]"}>
      <Skeleton className="h-4 w-36" />
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="mt-4 h-4 w-full" />
      ))}
    </ShellCard>
  );
}
