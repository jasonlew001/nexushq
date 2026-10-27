import { Card } from "@/components/ui/card";
import { Skeleton, ShellCard } from "@/components/ui/skeleton";
import { getVercelErrors } from "@/lib/data/vercel-metrics";
import { VercelUnavailable } from "./vercel-states";
import { cn } from "@/lib/cn";

// Seven tiny day-cells: height = that day's errors relative to the route's
// worst day. Empty days show a hairline so the week's shape still reads.
function DayStrip({ daily, days }: { daily: number[]; days: string[] }) {
  const max = Math.max(...daily, 1);
  return (
    <span className="flex h-4 items-end gap-[2px]" aria-hidden>
      {daily.map((n, i) => (
        <span
          key={days[i]}
          title={`${days[i]}: ${n}`}
          className={cn("w-1.5 rounded-[1px]", n > 0 ? "bg-danger" : "bg-edge")}
          style={{ height: n > 0 ? `${Math.max(25, (n / max) * 100)}%` : "2px" }}
        />
      ))}
    </span>
  );
}

function formatRate(errors: number, requests: number | null): string {
  if (requests == null || requests === 0) return "—";
  const rate = errors / requests;
  if (rate === 0) return "0%";
  if (rate < 0.001) return "<0.1%";
  return `${(rate * 100).toFixed(1)}%`;
}

// Production server errors per route, trailing 7 days, from Vercel's
// observability metrics (request counts by route + status). Counts only;
// the stack traces are one click away in Vercel's logs.
export async function RouteErrorsPanel() {
  const { data } = await getVercelErrors();

  if (!data.connected) return null; // the production panel shows the setup hint
  if (data.error) return <VercelUnavailable title="Server errors" message={data.error} />;

  return (
    <Card className="p-0">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-edge px-4 py-3">
        <div>
          <p className="text-sm font-medium">Server errors by route</p>
          <p className="mt-0.5 text-xs text-faint">
            Production 5xx over 7 days, plus 4xx on the Stripe webhook (a failed signature check).
          </p>
        </div>
        <div className="flex items-end gap-5">
          <div className="text-right">
            <p className="text-xs text-muted">7 days</p>
            <p className={cn("tnum text-lg font-semibold leading-none", data.totalErrors > 0 && "text-danger")}>
              {data.totalErrors}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted">Today</p>
            <p className={cn("tnum text-lg font-semibold leading-none", data.errorsToday > 0 && "text-danger")}>
              {data.errorsToday}
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-faint">
              <th className="px-4 py-2 font-normal">Route</th>
              <th className="px-2 py-2 text-right font-normal">Requests</th>
              <th className="px-2 py-2 text-right font-normal">Errors</th>
              <th className="px-2 py-2 text-right font-normal">Rate</th>
              <th className="px-2 py-2 font-normal">Codes</th>
              <th className="px-4 py-2 font-normal">
                <span className="sr-only">Errors per day</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge">
            {data.routes.map((r) => (
              <tr key={r.route}>
                <td className="max-w-[260px] truncate px-4 py-2 font-mono text-[11.5px]" title={r.route}>
                  {r.route}
                </td>
                <td className="tnum px-2 py-2 text-right text-muted">
                  {r.requests == null ? "—" : r.requests.toLocaleString()}
                </td>
                <td className={cn("tnum px-2 py-2 text-right", r.errors > 0 ? "font-medium text-danger" : "text-faint")}>
                  {r.errors}
                </td>
                <td className="tnum px-2 py-2 text-right text-muted">{formatRate(r.errors, r.requests)}</td>
                <td className="px-2 py-2 font-mono text-[11px] text-muted">{r.statuses.join(" ") || ""}</td>
                <td className="px-4 py-2">
                  <DayStrip daily={r.daily} days={data.days} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function RouteErrorsPanelSkeleton() {
  return (
    <ShellCard className="h-[300px]">
      <Skeleton className="h-4 w-44" />
      <Skeleton className="mt-2 h-3 w-72" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="mt-4 h-5 w-full" />
      ))}
    </ShellCard>
  );
}
