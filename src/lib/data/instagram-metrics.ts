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
  // Set when connected=true but this fetch cycle failed (Meta rate-limit or
  // transient error) — distinct from "never connected". UI shows a degraded
  // message instead of stale/partial numbers. Previously an uncaught throw
  // here crashed the entire Overview page (see git history) since neither
  // this function nor its callers had any error handling.
  error: string | null;
}

const EMPTY: InstagramMetrics = {
  connected: false,
  followerCount: null,
  mediaCount: null,
  insights: { reach: null, profileViews: null, accountsEngaged: null },
  recentMedia: [],
  reachHistory: [],
  followerHistory: [],
  error: null,
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
  let token;
  try {
    token = await getValidAccessToken();
  } catch (err) {
    console.error("Instagram: failed to load/refresh access token", err);
    return {
      data: { ...EMPTY, connected: true, error: "Couldn't refresh the Instagram connection." },
      fetchedAt: new Date().toISOString(),
    };
  }

  if (!token) {
    return { data: EMPTY, fetchedAt: new Date().toISOString() };
  }

  try {
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
        error: null,
      },
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    // Most likely cause: Meta rate-limited the burst of per-post insight
    // calls in fetchRecentMedia, or a transient 5xx from the Graph API.
    // Degrade this card/page instead of throwing — an uncaught error here
    // previously crashed the whole Overview page render.
    console.error("Instagram: failed to fetch account/media data", err);
    return {
      data: {
        ...EMPTY,
        connected: true,
        error: "Instagram data is temporarily unavailable. It refreshes hourly, or click Sync data to retry now.",
      },
      fetchedAt: new Date().toISOString(),
    };
  }
}

export const getInstagramMetrics = unstable_cache(fetchInstagramMetrics, ["hq-instagram-metrics"], {
  revalidate: 3600,
  tags: ["hq-instagram"],
});
