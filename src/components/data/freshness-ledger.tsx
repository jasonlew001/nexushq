import { LiveDot } from "@/components/ui/live-dot";
import { Skeleton } from "@/components/ui/skeleton";
import { getDataFreshness, type DatasetFreshness } from "@/lib/data/freshness";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";

type Tone = "accent" | "neutral" | "warn" | "danger";

// Same thresholds as before the redesign: imports happen in batches, so a
// few weeks old is normal — flag things that look forgotten, not merely
// not-daily.
function ageTone(ageDays: number | null): { tone: Tone; label: string } {
  if (ageDays == null) return { tone: "danger", label: "no timestamp" };
  if (ageDays <= 7) return { tone: "accent", label: "fresh" };
  if (ageDays <= 30) return { tone: "neutral", label: "recent" };
  if (ageDays <= 90) return { tone: "warn", label: "aging" };
  return { tone: "danger", label: "stale" };
}

const TONE_DOT: Record<Tone, string> = {
  accent: "bg-accent",
  neutral: "bg-muted",
  warn: "bg-warn",
  danger: "bg-danger",
};

const TONE_TEXT: Record<Tone, string> = {
  accent: "text-accent",
  neutral: "text-muted",
  warn: "text-warn",
  danger: "text-danger",
};

// Age → position on a 4-zone meter (fresh 0–7 / recent 7–30 / aging 30–90 /
// stale 90–180+). Zones render equal-width, so the mapping is piecewise
// linear within each zone rather than linear in days.
function meterPosition(ageDays: number | null): number {
  if (ageDays == null) return 100;
  const zones: [number, number][] = [
    [0, 7],
    [7, 30],
    [30, 90],
    [90, 180],
  ];
  for (let i = 0; i < zones.length; i++) {
    const [lo, hi] = zones[i];
    if (ageDays <= hi) {
      return i * 25 + ((ageDays - lo) / (hi - lo)) * 25;
    }
  }
  return 100;
}

function AgeMeter({ ageDays, tone }: { ageDays: number | null; tone: Tone }) {
  const pos = Math.min(Math.max(meterPosition(ageDays), 1), 99);

  return (
    <div className="relative h-1.5 w-full overflow-hidden rounded-full">
      {/* Zone tints: fresh -> recent -> aging -> stale */}
      <div className="absolute inset-0 flex">
        <div className="h-full w-1/4 bg-accent/15" />
        <div className="h-full w-1/4 bg-muted/15" />
        <div className="h-full w-1/4 bg-warn/15" />
        <div className="h-full w-1/4 bg-danger/15" />
      </div>
      {/* Marker tick */}
      <div
        className={cn("absolute top-0 h-full w-0.5 rounded-full", TONE_DOT[tone])}
        style={{ left: `${pos}%` }}
      />
    </div>
  );
}

function statusHeadline(datasets: DatasetFreshness[]): { tone: Tone; text: string } {
  const stale = datasets.filter((d) => d.ageDays == null || d.ageDays > 90).length;
  const aging = datasets.filter((d) => d.ageDays != null && d.ageDays > 30 && d.ageDays <= 90).length;
  if (stale > 0) return { tone: "danger", text: `${stale} DATASET${stale === 1 ? "" : "S"} STALE` };
  if (aging > 0) return { tone: "warn", text: `${aging} DATASET${aging === 1 ? "" : "S"} AGING` };
  return { tone: "accent", text: "SYSTEMS NOMINAL" };
}

export async function FreshnessLedger() {
  const datasets = await getDataFreshness();

  const totalRows = datasets.reduce((sum, d) => sum + d.rowCount, 0);
  const maxRows = Math.max(...datasets.map((d) => d.rowCount), 1);
  const status = statusHeadline(datasets);

  return (
    <div className="rounded-lg border border-edge bg-surface">
      {/* Status header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-edge px-4 py-3">
        <div className="flex items-center gap-2.5">
          <LiveDot tone={status.tone === "neutral" ? "accent" : status.tone} />
          <p className={cn("text-sm font-semibold tracking-widest", TONE_TEXT[status.tone])}>
            {status.text}
          </p>
        </div>
        <p className="text-xs text-faint">
          <span className="tnum">{datasets.length}</span> datasets ·{" "}
          <span className="tnum">{totalRows.toLocaleString()}</span> total rows
        </p>
      </div>

      {/* Meter scale legend (desktop only, aligns with the meter column) */}
      <div className="hidden items-center justify-end gap-4 border-b border-edge px-4 py-1.5 sm:flex">
        <div className="flex w-44 shrink-0 justify-between text-[9px] uppercase tracking-wider text-faint">
          <span>fresh</span>
          <span>30d</span>
          <span>90d</span>
          <span>stale</span>
        </div>
        <div className="w-24 shrink-0" />
      </div>

      {/* Ledger rows */}
      <div className="stagger divide-y divide-edge">
        {datasets.map((dataset) => {
          const { tone, label } = ageTone(dataset.ageDays);
          return (
            <div
              key={dataset.key}
              className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-2"
            >
              <span
                className={cn("h-2 w-2 shrink-0 rounded-full", TONE_DOT[tone])}
                title={label}
              />

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{dataset.label}</p>
                <p className="truncate text-xs text-faint">{dataset.description}</p>
              </div>

              {/* Row count + proportional bar */}
              <div className="hidden w-32 shrink-0 md:block">
                <p className="tnum text-right text-xs text-muted">
                  {dataset.rowCount.toLocaleString()} rows
                </p>
                <div className="mt-1 h-1 w-full rounded-full bg-surface-2">
                  <div
                    className="h-1 rounded-full bg-edge-strong"
                    style={{ width: `${Math.max((dataset.rowCount / maxRows) * 100, 2)}%` }}
                  />
                </div>
              </div>

              {/* Age meter */}
              <div className="hidden w-44 shrink-0 sm:block">
                <AgeMeter ageDays={dataset.ageDays} tone={tone} />
              </div>

              {/* Relative time */}
              <p
                className={cn("w-24 shrink-0 text-right text-xs", TONE_TEXT[tone])}
                title={dataset.lastUpdatedAt ? formatDate(dataset.lastUpdatedAt) : undefined}
              >
                {dataset.lastUpdatedAt ? formatRelativeTime(dataset.lastUpdatedAt) : "never"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function FreshnessLedgerSkeleton() {
  return (
    <div className="rounded-lg border border-edge bg-surface">
      <div className="flex items-center justify-between border-b border-edge px-4 py-3">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-3 w-36" />
      </div>
      <div className="divide-y divide-edge">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="h-2 w-2 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="hidden h-3 w-32 md:block" />
            <Skeleton className="hidden h-2 w-44 sm:block" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
