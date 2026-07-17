import type { AttributionSplit } from "@/lib/data/signups";

// Tracked-vs-unknown for the same cohort as the This-week panel's headline
// figure (SignupMetrics.lastCompleteWeekAttribution) — real counts, no
// separate fetch.
export function AttributionSplitBar({ tracked, unknown }: AttributionSplit) {
  const total = tracked + unknown;

  if (total === 0) {
    return <p className="text-xs text-faint">No signups that week</p>;
  }

  const trackedPct = (tracked / total) * 100;

  return (
    <div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-2">
        <div className="bg-accent" style={{ width: `${trackedPct}%` }} />
        <div className="bg-faint/40" style={{ width: `${100 - trackedPct}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          {tracked} tracked
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-faint/60" />
          {unknown} unknown
        </span>
      </div>
    </div>
  );
}
