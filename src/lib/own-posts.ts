import type { SupabaseClient } from "@supabase/supabase-js";
import type { InstagramMedia } from "@/lib/instagram";
import { themeOf } from "@/lib/theme-rules.mjs";

if (typeof window !== "undefined") {
  throw new Error("own-posts.ts must never be imported client-side");
}

// Our own posts -> hq_own_posts + a daily hq_own_post_snapshots row each
// (sql/010). Called from the daily cron with the service-role client.

const TIKTOK_HANDLE = "nexusgolfrecruiting";
const TIKTOK_STATE_KEY = "tiktok_own_run";
const MONID = "https://api.monid.ai/v1";

interface OwnPost {
  platform: "instagram" | "tiktok";
  external_id: string;
  url: string;
  caption: string | null;
  format: "video" | "slideshow" | "reel" | "carousel" | "image";
  posted_at: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  reach: number | null;
}

const IG_FORMAT: Record<string, OwnPost["format"]> = {
  VIDEO: "reel",
  REELS: "reel",
  CAROUSEL_ALBUM: "carousel",
  IMAGE: "image",
};

const tagsOf = (caption: string | null) =>
  Array.from(new Set((caption ?? "").match(/#[^\s#]+/g) ?? [])).map((t) => t.slice(1).toLowerCase());

const num = (v: unknown): number | null => {
  const n = Number(v);
  return v === null || v === undefined || !Number.isFinite(n) || n < 0 ? null : Math.round(n);
};

async function savePosts(admin: SupabaseClient, posts: OwnPost[]): Promise<number> {
  if (!posts.length) return 0;
  const platform = posts[0].platform;

  // A theme a founder corrected is never overwritten. Two upserts because a
  // batch upsert nulls any column missing from a row.
  const { data: locked, error: lockedError } = await admin
    .from("hq_own_posts")
    .select("external_id")
    .eq("platform", platform)
    .eq("theme_set_by_founder", true);
  if (lockedError) throw new Error(`Own posts read failed: ${lockedError.message}`);
  const lockedIds = new Set((locked ?? []).map((r: { external_id: string }) => r.external_id));

  const now = new Date().toISOString();
  const auto = posts
    .filter((p) => !lockedIds.has(p.external_id))
    .map((p) => ({ ...p, theme: themeOf({ caption: p.caption, hashtags: tagsOf(p.caption) }), updated_at: now }));
  const kept = posts.filter((p) => lockedIds.has(p.external_id)).map((p) => ({ ...p, updated_at: now }));

  type SavedRow = Pick<OwnPost, "posted_at" | "views" | "likes" | "comments" | "shares" | "saves" | "reach"> & { id: string };
  const saved: SavedRow[] = [];
  for (const batch of [auto, kept]) {
    if (!batch.length) continue;
    const { data, error } = await admin
      .from("hq_own_posts")
      .upsert(batch, { onConflict: "platform,external_id" })
      .select("id, posted_at, views, likes, comments, shares, saves, reach");
    if (error) throw new Error(`Own posts upsert failed: ${error.message}`);
    saved.push(...((data ?? []) as SavedRow[]));
  }

  const today = now.slice(0, 10);
  const snapshots = saved.map(
    (p) => ({
      post_id: p.id,
      captured_on: today,
      age_days: Math.max(0, Math.floor((Date.parse(now) - Date.parse(p.posted_at)) / 86_400_000)),
      views: p.views,
      likes: p.likes,
      comments: p.comments,
      shares: p.shares,
      saves: p.saves,
      reach: p.reach,
    })
  );
  const { error: snapError } = await admin
    .from("hq_own_post_snapshots")
    .upsert(snapshots, { onConflict: "post_id,captured_on" });
  if (snapError) throw new Error(`Own post snapshots failed: ${snapError.message}`);
  return saved.length;
}

export async function syncInstagramOwnPosts(admin: SupabaseClient, media: InstagramMedia[]): Promise<number> {
  return savePosts(
    admin,
    media.map((m) => ({
      platform: "instagram",
      external_id: m.id,
      url: m.permalink,
      caption: m.caption,
      format: IG_FORMAT[m.mediaType] ?? "image",
      posted_at: m.timestamp,
      views: m.views,
      likes: m.likeCount,
      comments: m.commentsCount,
      shares: m.shares,
      saves: m.saved,
      reach: m.reach,
    }))
  );
}

interface TikTokItem {
  id?: string;
  postPage?: string;
  title?: string;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  bookmarks?: number;
  uploadedAtFormatted?: string;
  images?: unknown[];
}

// A TikTok scrape takes 30–60s, longer than a cron invocation should wait,
// so each run collects the previous day's scrape and starts the next one.
// Data lags a day; cost is one ~$0.01 Monid run per day.
export async function syncTikTokOwnPosts(admin: SupabaseClient): Promise<{ saved: number; started: boolean }> {
  const key = process.env.MONID_API_KEY;
  if (!key) return { saved: 0, started: false };
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

  const { data: state } = await admin.from("hq_sync_state").select("value").eq("key", TIKTOK_STATE_KEY).maybeSingle();
  const pendingRunId = (state?.value as { runId?: string } | undefined)?.runId;

  let saved = 0;
  if (pendingRunId) {
    const run = await (await fetch(`${MONID}/runs/${pendingRunId}`, { headers, cache: "no-store" })).json();
    if (run.status === "RUNNING" || run.status === "READY") {
      return { saved: 0, started: false }; // still going; collect tomorrow
    }
    if (run.status === "COMPLETED" && Array.isArray(run.output)) {
      const items = run.output as TikTokItem[];
      saved = await savePosts(
        admin,
        items
          .filter((i) => i.id && i.postPage && i.uploadedAtFormatted)
          .map((i) => ({
            platform: "tiktok",
            external_id: String(i.id),
            url: i.postPage!,
            caption: i.title ?? null,
            format: i.images?.length ? "slideshow" : "video",
            posted_at: i.uploadedAtFormatted!,
            views: num(i.views),
            likes: num(i.likes),
            comments: num(i.comments),
            shares: num(i.shares),
            saves: num(i.bookmarks),
            reach: null,
          }))
      );
    }
  }

  const res = await fetch(`${MONID}/run`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      provider: "apify",
      endpoint: "/apidojo/tiktok-scraper",
      input: { body: { startUrls: [`https://www.tiktok.com/@${TIKTOK_HANDLE}`], maxItems: 60 } },
    }),
  });
  const started = await res.json();
  if (!started.runId) throw new Error(`Monid TikTok run failed to start: ${started.message ?? res.status}`);
  const { error } = await admin
    .from("hq_sync_state")
    .upsert({ key: TIKTOK_STATE_KEY, value: { runId: started.runId }, updated_at: new Date().toISOString() });
  if (error) throw new Error(`Saving TikTok run id failed: ${error.message}`);
  return { saved, started: true };
}
