import { unstable_cache } from "next/cache";
import { getAdminClient } from "@/lib/supabase-server";
import {
  getValidAccessToken,
  fetchAccountStats,
  fetchAccountInsights,
  fetchReachHistory,
  fetchFollowerDeltaHistory,
  fetchRecentMedia,
  type InstagramMedia,
  type AccountInsights,
  type DailyMetricPoint,
} from "@/lib/instagram";
import type { CachedResult } from "@/lib/types";

if (typeof window !== "undefined") {
  throw new Error("instagram-metrics.ts must never be imported client-side");
}

export interface InstagramMetrics {
  connected: boolean;
  followerCount: number | null;
  mediaCount: number | null;
  // Trailing 30-day account totals — reach/profile views/engaged accounts.
  insights: AccountInsights;
  recentMedia: InstagramMedia[];
  // Real history, up to 365 days: reach is Meta's actual daily value;
  // followerHistory is reconstructed by walking the daily follower_count
  // DELTA backward from today's true count (see fetchFollowerDeltaHistory's
  // comment in src/lib/instagram.ts for why it can't be used directly).
  reachHistory: DailyMetricPoint[];
  followerHistory: DailyMetricPoint[];
}

const EMPTY: InstagramMetrics = {
  connected: false,
  followerCount: null,
  mediaCount: null,
  insights: { reach: null, profileViews: null, accountsEngaged: null },
  recentMedia: [],
  reachHistory: [],
  followerHistory: [],
};

// deltas is oldest→newest, ending "today". Reconstructs each day's
// end-of-day total by subtracting later deltas from today's true count.
function reconstructFollowerHistory(deltas: DailyMetricPoint[], currentTotal: number): DailyMetricPoint[] {
  const totals = new Array<number>(deltas.length);
  let running = currentTotal;
  for (let i = deltas.length - 1; i >= 0; i--) {
    totals[i] = running;
    running -= deltas[i].value;
  }
  return deltas.map((d, i) => ({ date: d.date, value: totals[i] }));
}

async function fetchInstagramMetrics(): Promise<CachedResult<InstagramMetrics>> {
  const token = await getValidAccessToken();

  if (!token) {
    return { data: EMPTY, fetchedAt: new Date().toISOString() };
  }

  const [stats, insights, reachHistory, followerDeltas, recentMedia] = await Promise.all([
    fetchAccountStats(token.igUserId, token.accessToken),
    fetchAccountInsights(token.igUserId, token.accessToken),
    fetchReachHistory(token.igUserId, token.accessToken),
    fetchFollowerDeltaHistory(token.igUserId, token.accessToken),
    fetchRecentMedia(token.igUserId, token.accessToken),
  ]);

  return {
    data: {
      connected: true,
      followerCount: stats.followerCount,
      mediaCount: stats.mediaCount,
      insights,
      recentMedia,
      reachHistory,
      followerHistory: reconstructFollowerHistory(followerDeltas, stats.followerCount),
    },
    fetchedAt: new Date().toISOString(),
  };
}

export const getInstagramMetrics = unstable_cache(fetchInstagramMetrics, ["hq-instagram-metrics"], {
  revalidate: 3600,
  tags: ["hq-instagram"],
});
