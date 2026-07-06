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

export interface SignupMetrics {
  totalSignups: number;
  payingSubscribers: number;
  signupToPaidConversion: number;
  weekly: WeeklySignupBucket[];
  byState: StateBucket[];
  unknownStateCount: number;
  wow: { current: number; previous: number; deltaPct: number | null };
  // Stable, count-ranked category order — the source of truth for color
  // assignment so the same UTM source always gets the same chart color,
  // whether it appears in the weekly stack or the breakdown chart.
  topUtmSources: string[];
  utmBreakdown: SourceBucket[]; // all signups
  hearAboutUsBreakdown: SourceBucket[]; // paying customers only
}

const TOP_UTM_SOURCE_CAP = 6;
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

  // Pass 2: weekly stacked buckets, trailing CHART_WEEKS weeks.
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
    const key = bucketUtmSource(row.utmSource);
    bucket.byUtmSource[key] = (bucket.byUtmSource[key] ?? 0) + 1;
  }
  const weekly = Array.from(weekMap.values()).sort((a, b) => a.weekStart.localeCompare(b.weekStart));

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

  return {
    totalSignups,
    payingSubscribers,
    signupToPaidConversion: totalSignups > 0 ? payingSubscribers / totalSignups : 0,
    weekly,
    byState,
    unknownStateCount,
    wow: { current, previous, deltaPct },
    topUtmSources,
    utmBreakdown,
    hearAboutUsBreakdown,
  };
});
