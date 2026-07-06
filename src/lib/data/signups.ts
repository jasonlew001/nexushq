import { cache } from "react";
import { getCustomerRows } from "./customers";
import { startOfWeekUTC, weeksAgoUTC } from "@/lib/format";
import { CHART_WEEKS } from "@/lib/constants";

export interface WeeklySignupBucket {
  weekStart: string;
  total: number;
  byUtmSource: Record<string, number>;
}

export interface StateBucket {
  state: string;
  count: number;
}

export interface SignupMetrics {
  totalSignups: number;
  payingSubscribers: number;
  signupToPaidConversion: number;
  weekly: WeeklySignupBucket[];
  byState: StateBucket[];
  unknownStateCount: number;
  wow: { current: number; previous: number; deltaPct: number | null };
}

const UNATTRIBUTED = "unattributed";

export const getSignupMetrics = cache(async (): Promise<SignupMetrics> => {
  const rows = await getCustomerRows();

  const totalSignups = rows.length;
  const payingSubscribers = rows.filter(
    (r) => r.tier === "premium" && (r.status === "active" || r.status === "past_due")
  ).length;

  // Weekly buckets, stacked by UTM source, for the trailing CHART_WEEKS weeks.
  const earliestWeek = startOfWeekUTC(weeksAgoUTC(CHART_WEEKS - 1));
  const weekMap = new Map<string, WeeklySignupBucket>();

  for (const row of rows) {
    const weekStart = startOfWeekUTC(new Date(row.signedUpAt));
    if (weekStart < earliestWeek) continue;

    let bucket = weekMap.get(weekStart);
    if (!bucket) {
      bucket = { weekStart, total: 0, byUtmSource: {} };
      weekMap.set(weekStart, bucket);
    }
    bucket.total += 1;
    const source = row.utmSource ?? UNATTRIBUTED;
    bucket.byUtmSource[source] = (bucket.byUtmSource[source] ?? 0) + 1;
  }

  const weekly = Array.from(weekMap.values()).sort((a, b) =>
    a.weekStart.localeCompare(b.weekStart)
  );

  // Signups by state (parsed from city_state; messy/NULL tolerated).
  const stateMap = new Map<string, number>();
  let unknownStateCount = 0;
  for (const row of rows) {
    if (row.state) {
      stateMap.set(row.state, (stateMap.get(row.state) ?? 0) + 1);
    } else {
      unknownStateCount += 1;
    }
  }
  const byState = Array.from(stateMap.entries())
    .map(([state, count]) => ({ state, count }))
    .sort((a, b) => b.count - a.count);

  // Week-over-week: last two complete weeks (excludes the current
  // in-progress week so the comparison isn't skewed by a partial week).
  const completeWeeks = weekly.filter((w) => w.weekStart < startOfWeekUTC(new Date()));
  const current = completeWeeks.at(-1)?.total ?? 0;
  const previous = completeWeeks.at(-2)?.total ?? 0;
  const deltaPct = previous > 0 ? (current - previous) / previous : null;

  return {
    totalSignups,
    payingSubscribers,
    signupToPaidConversion: totalSignups > 0 ? payingSubscribers / totalSignups : 0,
    weekly,
    byState,
    unknownStateCount,
    wow: { current, previous, deltaPct },
  };
});
