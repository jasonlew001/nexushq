import { cache } from "react";
import { getCustomerRows } from "./customers";
import { startOfWeekUTC, weeksAgoUTC } from "@/lib/format";
import { CHART_WEEKS, UNATTRIBUTED, OTHER_SOURCE, NO_ACQ_DATA } from "@/lib/constants";
import type { AcqSource } from "@/lib/types";

export interface WeeklySignupBucket {
  weekStart: string;
  total: number;
  byUtmSource: Record<string, number>;
}

export interface StateBucket {
  state: string;
  count: number;
}

export interface SourceBucket {
  source: string;
  count: number;
}

export interface DailySignupBucket {
  date: string; // YYYY-MM-DD, UTC
  count: number;
}

export interface AttributionSplit {
  tracked: number;
  unknown: number;
}

export interface SignupMetrics {
  totalSignups: number;
  payingSubscribers: number;
  signupToPaidConversion: number;
  weekly: WeeklySignupBucket[];
  byState: StateBucket[];
  unknownStateCount: number;
  // "current" here is the last *complete* calendar week — the canonical
  // "signups this week" figure, chosen because it's the one the WoW % is
  // comparable against (a partial in-progress week can't be fairly compared
  // to a full prior week). The action strip's "new this week" is a
  // deliberately different, separate figure: the current in-progress week.
  wow: { current: number; previous: number; deltaPct: number | null };
  // Same weekly buckets, restricted to customers who are currently paying
  // (premium + active/past_due) — the "exclude non-paying users" chart
  // filter. Note: cohort membership is *today's* payment status; a user who
  // later paid counts in their original signup week.
  weeklyPayingOnly: WeeklySignupBucket[];
  // Trailing 7 calendar days (UTC), including today's partial day — for the
  // day-bar chart. Independent of the weekly buckets above.
  dailySignups: DailySignupBucket[];
  // Attribution split for the same cohort as `wow.current` (last complete
  // week), so the This-week panel's numbers are internally consistent.
  lastCompleteWeekAttribution: AttributionSplit;
  // Stable, count-ranked category order — the source of truth for color
  // assignment so the same UTM source always gets the same chart color,
  // whether it appears in the weekly stack or the breakdown chart.
  topUtmSources: string[];
  utmBreakdown: SourceBucket[]; // all signups
  hearAboutUsBreakdown: SourceBucket[]; // paying customers only
}

const TOP_UTM_SOURCE_CAP = 6;
const DAILY_WINDOW_DAYS = 7;
const ACQ_SOURCE_ORDER: Exclude<AcqSource, null>[] = [
  "coach_referral",
  "instagram",
  "google_search",
  "friend_teammate",
  "tournament",
  "other",
];

export const getSignupMetrics = cache(async (): Promise<SignupMetrics> => {
  const rows = await getCustomerRows();

  const totalSignups = rows.length;
  const paying = rows.filter(
    (r) => r.tier === "premium" && (r.status === "active" || r.status === "past_due")
  );
  const payingSubscribers = paying.length;

  // Pass 1: rank UTM sources by total count across the whole dataset (not
  // just the chart window) so the top-N list — and therefore the color
  // assignment — doesn't shift as the trailing-weeks window moves.
  const sourceCounts = new Map<string, number>();
  for (const row of rows) {
    if (row.utmSource) {
      sourceCounts.set(row.utmSource, (sourceCounts.get(row.utmSource) ?? 0) + 1);
    }
  }
  const topUtmSources = Array.from(sourceCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_UTM_SOURCE_CAP)
    .map(([source]) => source);
  const topUtmSet = new Set(topUtmSources);

  function bucketUtmSource(source: string | null): string {
    if (!source) return UNATTRIBUTED;
    return topUtmSet.has(source) ? source : OTHER_SOURCE;
  }

  // Pass 2: weekly stacked buckets, trailing CHART_WEEKS weeks — built for
  // the full cohort and (with the same shape) for currently-paying users
  // only, so the chart's cohort toggle is a data swap, not a re-fetch.
  const earliestWeek = startOfWeekUTC(weeksAgoUTC(CHART_WEEKS - 1));
  const payingIds = new Set(paying.map((r) => r.id));
  const weekMap = new Map<string, WeeklySignupBucket>();
  const payingWeekMap = new Map<string, WeeklySignupBucket>();

  function addToBucket(map: Map<string, WeeklySignupBucket>, weekStart: string, sourceKey: string) {
    let bucket = map.get(weekStart);
    if (!bucket) {
      bucket = { weekStart, total: 0, byUtmSource: {} };
      map.set(weekStart, bucket);
    }
    bucket.total += 1;
    bucket.byUtmSource[sourceKey] = (bucket.byUtmSource[sourceKey] ?? 0) + 1;
  }

  for (const row of rows) {
    const weekStart = startOfWeekUTC(new Date(row.signedUpAt));
    if (weekStart < earliestWeek) continue;
    const key = bucketUtmSource(row.utmSource);
    addToBucket(weekMap, weekStart, key);
    if (payingIds.has(row.id)) addToBucket(payingWeekMap, weekStart, key);
  }
  const weekly = Array.from(weekMap.values()).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  const weeklyPayingOnly = Array.from(payingWeekMap.values()).sort((a, b) =>
    a.weekStart.localeCompare(b.weekStart)
  );

  // UTM breakdown — all signups, same bucketing as the weekly stack.
  const utmBreakdownMap = new Map<string, number>();
  for (const row of rows) {
    const key = bucketUtmSource(row.utmSource);
    utmBreakdownMap.set(key, (utmBreakdownMap.get(key) ?? 0) + 1);
  }
  const utmBreakdown = Array.from(utmBreakdownMap.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);

  // Hear-about-us — paying customers only (acq_source only exists for
  // payers; null among payers means they paid before Part A shipped).
  const hearAboutMap = new Map<string, number>();
  for (const row of paying) {
    const key = row.acqSource ?? NO_ACQ_DATA;
    hearAboutMap.set(key, (hearAboutMap.get(key) ?? 0) + 1);
  }
  const hearAboutUsBreakdown = [...ACQ_SOURCE_ORDER, NO_ACQ_DATA]
    .filter((key) => hearAboutMap.has(key))
    .map((source) => ({ source, count: hearAboutMap.get(source)! }));

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

  // WoW: last two *complete* weeks (excludes the current in-progress week).
  const completeWeeks = weekly.filter((w) => w.weekStart < startOfWeekUTC(new Date()));
  const current = completeWeeks.at(-1)?.total ?? 0;
  const previous = completeWeeks.at(-2)?.total ?? 0;
  const deltaPct = previous > 0 ? (current - previous) / previous : null;

  // Attribution split for that same last-complete-week cohort — derived
  // from the weekly bucket we already built, not a new pass over `rows`.
  const lastCompleteWeekBucket = completeWeeks.at(-1);
  const lastCompleteWeekUnattributed = lastCompleteWeekBucket?.byUtmSource[UNATTRIBUTED] ?? 0;
  const lastCompleteWeekAttribution: AttributionSplit = {
    tracked: (lastCompleteWeekBucket?.total ?? 0) - lastCompleteWeekUnattributed,
    unknown: lastCompleteWeekUnattributed,
  };

  // Trailing 7 calendar days (UTC) including today, zero-filled so the bar
  // chart always renders 7 bars regardless of gaps.
  const dailyMap = new Map<string, number>();
  const today = new Date();
  const earliestDayKey = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (DAILY_WINDOW_DAYS - 1))
  )
    .toISOString()
    .slice(0, 10);
  for (const row of rows) {
    const dayKey = row.signedUpAt.slice(0, 10);
    if (dayKey < earliestDayKey) continue;
    dailyMap.set(dayKey, (dailyMap.get(dayKey) ?? 0) + 1);
  }
  const dailySignups: DailySignupBucket[] = [];
  for (let i = DAILY_WINDOW_DAYS - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
    const key = d.toISOString().slice(0, 10);
    dailySignups.push({ date: key, count: dailyMap.get(key) ?? 0 });
  }

  return {
    totalSignups,
    payingSubscribers,
    signupToPaidConversion: totalSignups > 0 ? payingSubscribers / totalSignups : 0,
    weekly,
    weeklyPayingOnly,
    byState,
    unknownStateCount,
    wow: { current, previous, deltaPct },
    dailySignups,
    lastCompleteWeekAttribution,
    topUtmSources,
    utmBreakdown,
    hearAboutUsBreakdown,
  };
});
