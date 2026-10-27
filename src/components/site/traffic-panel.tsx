import { Card } from "@/components/ui/card";
import { Skeleton, ShellCard } from "@/components/ui/skeleton";
import { VisitorsChart } from "@/components/charts/visitors-chart";
import { getVercelTraffic, type TrafficRow } from "@/lib/data/vercel-metrics";
import { VercelUnavailable } from "./vercel-states";

function BarList({ title, rows, mono = false }: { title: string; rows: TrafficRow[]; mono?: boolean }) {
  const top = rows.reduce((m, r) => Math.max(m, r.visitors), 0) || 1;
  return (
    <div className="min-w-0">
      <p className="mb-2 text-xs text-muted">{title}</p>
      {rows.length === 0 ? (
        <p className="text-xs text-faint">No visits yet.</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center gap-3">
              <span className={`w-36 shrink-0 truncate text-xs ${mono ? "font-mono text-[11.5px]" : ""}`} title={r.label}>
                {r.label}
              </span>
              <span className="h-2 min-w-[2px] rounded-full bg-accent/70" style={{ width: `${(r.visitors / top) * 100}%` }} />
              <span className="tnum ml-auto shrink-0 text-xs">{r.visitors.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Vercel Web Analytics for the main site: cookieless unique visitors, the
// pages they land on, and where they came from — the top of the funnel the
// signup charts can't see.
export async function TrafficPanel() {
  const { data } = await getVercelTraffic();

  if (!data.connected) return null;
  if (data.error) return <VercelUnavailable title="Site traffic" message={data.error} />;

  const delta =
    data.visitorsPrev7d != null && data.visitorsPrev7d > 0
      ? (data.visitors7d - data.visitorsPrev7d) / data.visitorsPrev7d
      : null;

  return (
    <Card className="p-0">
      <div className="flex flex-wrap items-end justify-between gap-4 px-4 pt-4">
        <div>
          <p className="text-sm font-medium">Site traffic</p>
          <p className="mt-0.5 text-xs text-faint">Unique visitors per day, last 30 days</p>
        </div>
        <div className="flex items-end gap-6">
          <div className="text-right">
            <p className="text-xs text-muted">Visitors · 7 days</p>
            <p className="tnum mt-1 text-lg font-semibold leading-none">{data.visitors7d.toLocaleString()}</p>
            {delta != null && (
              <p className={`mt-1 text-[11px] ${delta >= 0 ? "text-accent" : "text-danger"}`}>
                {delta >= 0 ? "▲" : "▼"} {Math.abs(delta * 100).toFixed(0)}% vs prior 7
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs text-muted">Pageviews · 7 days</p>
            <p className="tnum mt-1 text-lg font-semibold leading-none">{data.pageviews7d.toLocaleString()}</p>
            <p className="mt-1 text-[11px] text-faint">
              {data.visitors7d > 0 ? (data.pageviews7d / data.visitors7d).toFixed(1) : "—"} per visitor
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-3">
        <VisitorsChart daily={data.daily} />
      </div>

      <div className="mt-2 grid grid-cols-1 gap-6 border-t border-edge p-4 md:grid-cols-2">
        <BarList title="Top pages · 7 days" rows={data.topPages} mono />
        <BarList title="Referrers · 7 days" rows={data.referrers} />
      </div>
    </Card>
  );
}

export function TrafficPanelSkeleton() {
  return (
    <ShellCard className="h-[470px]">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-2 h-3 w-48" />
      <Skeleton className="mt-6 h-[180px] w-full" />
      <div className="mt-6 grid grid-cols-2 gap-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    </ShellCard>
  );
}
