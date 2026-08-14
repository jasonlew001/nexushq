import { getAdminClient } from "./supabase-server";

if (typeof window !== "undefined") {
  throw new Error("instagram.ts must never be imported client-side");
}

// Meta's redirect/token endpoints are unversioned; the data endpoints below
// (graph.instagram.com/v23.0/...) need a version — check
// developers.facebook.com/docs/graph-api/changelog for the current default
// if these start 400ing.
const GRAPH_VERSION = "v23.0";
const GRAPH_BASE = `https://graph.instagram.com/${GRAPH_VERSION}`;

// Refresh proactively once a token is within this many days of expiring —
// belt-and-suspenders on top of the daily cron, so one missed cron run
// doesn't silently break things for the full 60-day window.
const REFRESH_WINDOW_DAYS = 5;

interface TokenRow {
  ig_user_id: string;
  access_token: string;
  expires_at: string;
}

function requireAppCredentials(): { appId: string; appSecret: string; redirectUri: string } {
  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;
  if (!appId || !appSecret || !redirectUri) {
    throw new Error("INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET / INSTAGRAM_REDIRECT_URI not configured");
  }
  return { appId, appSecret, redirectUri };
}

async function parseOrThrow<T>(res: Response, label: string): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Instagram ${label} returned ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// Step 1→2 of the OAuth flow: the authorization code from the redirect
// callback, exchanged for a short-lived (1hr) token. POST, per Meta's docs
// (GETs to this endpoint are documented as unsupported).
export async function exchangeCodeForToken(
  code: string
): Promise<{ accessToken: string; userId: string }> {
  const { appId, appSecret, redirectUri } = requireAppCredentials();

  const body = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code,
  });

  const res = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const data = await parseOrThrow<{ access_token: string; user_id: number | string }>(
    res,
    "code-for-token exchange"
  );
  return { accessToken: data.access_token, userId: String(data.user_id) };
}

// Step 3: short-lived (or already-long-lived — this call is safe on both,
// per Meta's docs) → a fresh 60-day long-lived token.
export async function exchangeForLongLivedToken(
  shortLivedToken: string
): Promise<{ accessToken: string; expiresAt: Date }> {
  const { appSecret } = requireAppCredentials();

  const params = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: appSecret,
    access_token: shortLivedToken,
  });

  const res = await fetch(`https://graph.instagram.com/access_token?${params.toString()}`, {
    cache: "no-store",
  });
  const data = await parseOrThrow<{ access_token: string; expires_in: number }>(
    res,
    "long-lived token exchange"
  );
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

// Refresh a long-lived token for another 60 days. Only callable once the
// current token is >=24h old — always true given our refresh cadence
// (5-day window, daily cron).
export async function refreshLongLivedToken(
  currentToken: string
): Promise<{ accessToken: string; expiresAt: Date }> {
  const params = new URLSearchParams({
    grant_type: "ig_refresh_token",
    access_token: currentToken,
  });

  const res = await fetch(`https://graph.instagram.com/refresh_access_token?${params.toString()}`, {
    cache: "no-store",
  });
  const data = await parseOrThrow<{ access_token: string; expires_in: number }>(res, "token refresh");
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

export async function saveToken(igUserId: string, accessToken: string, expiresAt: Date): Promise<void> {
  const admin = getAdminClient();
  const { error } = await admin.from("hq_instagram_tokens").upsert(
    {
      ig_user_id: igUserId,
      access_token: accessToken,
      expires_at: expiresAt.toISOString(),
    },
    { onConflict: "ig_user_id" }
  );
  if (error) throw new Error(`Failed to save Instagram token: ${error.message}`);
}

async function getTokenRow(): Promise<TokenRow | null> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("hq_instagram_tokens")
    .select("ig_user_id, access_token, expires_at")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to read Instagram token: ${error.message}`);
  return data;
}

// The single entry point every data-fetching call should use. Returns null
// if never connected (the "not connected yet" state the UI branches on, not
// an error) — refreshes in place if the stored token is close to expiring.
export async function getValidAccessToken(): Promise<{ accessToken: string; igUserId: string } | null> {
  const row = await getTokenRow();
  if (!row) return null;

  const expiresAt = new Date(row.expires_at);
  const refreshBy = new Date(Date.now() + REFRESH_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  if (expiresAt > refreshBy) {
    return { accessToken: row.access_token, igUserId: row.ig_user_id };
  }

  const refreshed = await refreshLongLivedToken(row.access_token);
  await saveToken(row.ig_user_id, refreshed.accessToken, refreshed.expiresAt);
  return { accessToken: refreshed.accessToken, igUserId: row.ig_user_id };
}

export interface InstagramMedia {
  id: string;
  caption: string | null;
  mediaType: string;
  permalink: string;
  timestamp: string;
  likeCount: number;
  commentsCount: number;
  // thumbnailUrl covers VIDEO/REELS (media_url there is the raw video file,
  // not directly displayable as an <img>); falls back to mediaUrl for
  // IMAGE/CAROUSEL_ALBUM posts, which don't have a separate thumbnail.
  imageUrl: string | null;
  reach: number | null;
  saved: number | null;
  shares: number | null;
  views: number | null;
}

interface RawMedia {
  id: string;
  caption?: string;
  media_type: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
}

export interface AccountInsights {
  reach: number | null;
  profileViews: number | null;
  accountsEngaged: number | null;
}

// Current follower/media counts — no history, see hq_instagram_snapshots for
// the time series this feeds.
export async function fetchAccountStats(
  igUserId: string,
  accessToken: string
): Promise<{ followerCount: number; mediaCount: number }> {
  const params = new URLSearchParams({
    fields: "followers_count,media_count",
    access_token: accessToken,
  });
  const res = await fetch(`${GRAPH_BASE}/${igUserId}?${params.toString()}`, { cache: "no-store" });
  const data = await parseOrThrow<{ followers_count: number; media_count: number }>(res, "account stats");
  return { followerCount: data.followers_count, mediaCount: data.media_count };
}

// Trailing-30-day account totals — reach/profile views/engaged accounts.
// Meta requires `period` alongside `since`/`until` even for a total_value
// query; documented as "estimated and in development" on their side, not a
// bug here if these look approximate.
export async function fetchAccountInsights(
  igUserId: string,
  accessToken: string
): Promise<AccountInsights> {
  const since = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
  const until = Math.floor(Date.now() / 1000);
  const params = new URLSearchParams({
    metric: "reach,profile_views,accounts_engaged",
    metric_type: "total_value",
    period: "day",
    since: String(since),
    until: String(until),
    access_token: accessToken,
  });
  const res = await fetch(`${GRAPH_BASE}/${igUserId}/insights?${params.toString()}`, { cache: "no-store" });
  const data = await parseOrThrow<{ data: { name: string; total_value: { value: number } }[] }>(
    res,
    "account insights"
  );
  const byName = new Map(data.data.map((m) => [m.name, m.total_value.value]));
  return {
    reach: byName.get("reach") ?? null,
    profileViews: byName.get("profile_views") ?? null,
    accountsEngaged: byName.get("accounts_engaged") ?? null,
  };
}

export interface DailyMetricPoint {
  date: string; // YYYY-MM-DD, from the bucket's end_time
  value: number;
}

const MAX_HISTORY_DAYS = 365; // Meta caps at "the last 2 years"; 365 keeps one fetch fast

async function fetchDailyTimeSeries(
  igUserId: string,
  accessToken: string,
  metric: string,
  days: number
): Promise<DailyMetricPoint[]> {
  const since = Math.floor((Date.now() - Math.min(days, MAX_HISTORY_DAYS) * 24 * 60 * 60 * 1000) / 1000);
  const until = Math.floor(Date.now() / 1000);
  const params = new URLSearchParams({
    metric,
    metric_type: "time_series",
    period: "day",
    since: String(since),
    until: String(until),
    access_token: accessToken,
  });
  const res = await fetch(`${GRAPH_BASE}/${igUserId}/insights?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    data: { name: string; values: { value: number; end_time: string }[] }[];
  };
  const series = data.data[0]?.values ?? [];
  return series.map((v) => ({ date: v.end_time.slice(0, 10), value: v.value }));
}

// Daily REACH, real absolute values (not a delta) — up to 2 years of actual
// history, no reconstruction needed.
export async function fetchReachHistory(
  igUserId: string,
  accessToken: string,
  days = MAX_HISTORY_DAYS
): Promise<DailyMetricPoint[]> {
  return fetchDailyTimeSeries(igUserId, accessToken, "reach", days);
}

// Despite Meta's generic "Total number of unique accounts following this
// profile" description, `follower_count` from the insights time_series is
// actually a daily NET DELTA (new minus lost that day) — confirmed live:
// values don't remotely match the account's real follower count. Real
// cumulative totals get reconstructed in the data layer by walking these
// deltas backward from today's true count (fetchAccountStats).
export async function fetchFollowerDeltaHistory(
  igUserId: string,
  accessToken: string,
  days = MAX_HISTORY_DAYS
): Promise<DailyMetricPoint[]> {
  return fetchDailyTimeSeries(igUserId, accessToken, "follower_count", days);
}

// Per-post reach/saves/shares/views. Best-effort — `views` is Reels/video
// only and 400s the whole combined call for IMAGE/CAROUSEL_ALBUM posts, so
// this tries the full set first and falls back to the subset that works
// across every media type rather than losing everything for one bad metric.
async function fetchMediaInsights(
  mediaId: string,
  accessToken: string
): Promise<{ reach: number | null; saved: number | null; shares: number | null; views: number | null }> {
  const empty = { reach: null, saved: null, shares: null, views: null };

  async function tryFetch(metrics: string) {
    const params = new URLSearchParams({ metric: metrics, access_token: accessToken });
    const res = await fetch(`${GRAPH_BASE}/${mediaId}/insights?${params.toString()}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as { data: { name: string; values: { value: number }[] }[] };
  }

  const data = (await tryFetch("reach,saved,shares,views")) ?? (await tryFetch("reach,saved,shares"));
  if (!data) return empty;

  const byName = new Map(data.data.map((m) => [m.name, m.values[0]?.value ?? null]));
  return {
    reach: byName.get("reach") ?? null,
    saved: byName.get("saved") ?? null,
    shares: byName.get("shares") ?? null,
    views: byName.get("views") ?? null,
  };
}

// Every post (not just "recent") with engagement + per-post insights —
// paginates via paging.next since Instagram caps each page at 25-100 items,
// up to maxPosts as a safety cap. Used for the /social page's sortable grid
// and the daily snapshot's avg_likes/avg_comments.
interface MediaPage {
  data: RawMedia[];
  paging?: { next?: string };
}

async function fetchMediaPage(url: string): Promise<MediaPage> {
  const res = await fetch(url, { cache: "no-store" });
  return parseOrThrow<MediaPage>(res, "media page");
}

export async function fetchRecentMedia(
  igUserId: string,
  accessToken: string,
  maxPosts = 200
): Promise<InstagramMedia[]> {
  const firstUrl =
    `${GRAPH_BASE}/${igUserId}/media?` +
    new URLSearchParams({
      fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
      limit: "50",
      access_token: accessToken,
    }).toString();

  const results: RawMedia[] = [];
  let nextUrl: string | undefined = firstUrl;
  while (nextUrl !== undefined && results.length < maxPosts) {
    const page: MediaPage = await fetchMediaPage(nextUrl);
    results.push(...page.data);
    nextUrl = page.paging?.next;
  }

  const page = results.slice(0, maxPosts);

  return Promise.all(
    page.map(async (m) => {
      const insights = await fetchMediaInsights(m.id, accessToken);
      return {
        id: m.id,
        caption: m.caption ?? null,
        mediaType: m.media_type,
        permalink: m.permalink,
        timestamp: m.timestamp,
        likeCount: m.like_count ?? 0,
        commentsCount: m.comments_count ?? 0,
        imageUrl: m.thumbnail_url ?? m.media_url ?? null,
        ...insights,
      };
    })
  );
}
