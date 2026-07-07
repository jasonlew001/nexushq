import type { DailySignupBucket } from "@/lib/data/signups";

// Real trailing-7-day signup counts (SignupMetrics.dailySignups). Today's
// bar is highlighted since it's a partial day, not a complete one.
export function WeekBarChart({ daily }: { daily: DailySignupBucket[] }) {
  if (daily.length === 0) {
    return <p className="text-xs text-faint">No signups yet</p>;
  }

  const max = Math.max(...daily.map((d) => d.count), 1);
  const todayKey = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex h-24 items-end gap-1.5">
      {daily.map((d) => {
        const heightPct = d.count > 0 ? Math.max((d.count / max) * 100, 8) : 3;
        const isToday = d.date === todayKey;
        const dayLabel = new Date(`${d.date}T00:00:00Z`).toLocaleDateString("en-US", {
          weekday: "short",
          timeZone: "UTC",
        })[0];

        return (
          <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-16 w-full items-end" title={`${d.date}: ${d.count}`}>
              <div
                className={`w-full rounded-t transition-all ${isToday ? "bg-accent" : "bg-accent/40"}`}
                style={{ height: `${heightPct}%` }}
              />
            </div>
            <span className={`font-mono text-[9px] ${isToday ? "text-accent" : "text-faint"}`}>
              {dayLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}
