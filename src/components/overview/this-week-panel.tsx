import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getSignupMetrics } from "@/lib/data/signups";
import { formatPercent } from "@/lib/format";
import { WeekBarChart } from "./week-bar-chart";
import { AttributionSplitBar } from "./attribution-split-bar";

// Headline figure = SignupMetrics.wow.current — the last *complete*
// calendar week, the canonical "signups this week" number (see the
// comment on SignupMetrics.wow for why this was chosen over the action
// strip's current-in-progress-week count).
export async function ThisWeekPanel() {
  const signups = await getSignupMetrics();
  const { wow, dailySignups, lastCompleteWeekAttribution } = signups;

  const deltaTone = wow.deltaPct == null ? "text-faint" : wow.deltaPct >= 0 ? "text-accent" : "text-danger";
  const deltaSign = wow.deltaPct != null && wow.deltaPct >= 0 ? "+" : "";

  return (
    <Card hud hudTone="accent">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <p className="mb-1.5 font-mono text-[11px] uppercase tracking-wider text-muted">
            Signups this week
          </p>
          <p className="tnum font-mono text-2xl font-semibold leading-none">{wow.current}</p>
        </div>
        <span className={`tnum rounded-full bg-surface-2 px-2 py-0.5 font-mono text-xs ${deltaTone}`}>
          {wow.deltaPct == null ? "—" : `${deltaSign}${formatPercent(wow.deltaPct)} WoW`}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-faint">Last 7 days</p>
          <WeekBarChart daily={dailySignups} />
        </div>
        <div>
          <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-faint">
            Attribution (that week)
          </p>
          <AttributionSplitBar
            tracked={lastCompleteWeekAttribution.tracked}
            unknown={lastCompleteWeekAttribution.unknown}
          />
        </div>
      </div>
    </Card>
  );
}

export function ThisWeekPanelSkeleton() {
  return <Skeleton className="h-[200px] w-full rounded-lg" />;
}
