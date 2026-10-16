import { createSupabaseServerClient } from "@/lib/supabase-server";
import { INSPO_THEMES, type InspoTheme } from "@/lib/constants";
import { getInsights, hookOf, HOOK_LABELS, median } from "@/lib/data/inspiration-insights";

// What's working on OUR accounts. Views are compared to our own usual per
// platform ("1.8× our usual"), since TikTok and Instagram view counts aren't
// comparable; save rates are compared to the library's median for the same
// theme. A group needs MIN_POSTS before it gets a verdict.

export const MIN_POSTS = 3;
// Posts younger than this are still collecting views, so they stay out of
// the group verdicts (they still appear in the per-post table).
export const MIN_AGE_DAYS = 7;

export type OwnSort = "newest" | "views" | "index" | "saves";

export interface OwnPostRow {
  id: string;
  platform: "instagram" | "tiktok";
  url: string;
  caption: string | null;
  format: string;
  postedAt: string;
  theme: InspoTheme | null;
  themeSetByFounder: boolean;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  saveRate: number | null;
  shareRate: number | null;
  viewsIndex: number | null; // views ÷ our median views on that platform
  views7d: number | null; // from the day-7 snapshot, once one exists
  hook: string;
}

export type Verdict = "working" | "average" | "not-working" | "too-few";

export interface OwnGroupRow {
  key: string;
  label: string;
  posts: number;
  medianIndex: number | null;
  medianSaveRate: number | null;
  libraryMedianSaveRate: number | null; // themes only
  verdict: Verdict;
}

export interface OwnPostsData {
  posts: OwnPostRow[];
  counts: { instagram: number; tiktok: number };
  medianViews: { instagram: number | null; tiktok: number | null };
  medianSaveRate: number | null;
  byTheme: OwnGroupRow[];
  byHook: OwnGroupRow[];
  byFormat: OwnGroupRow[];
  lastSynced: string | null;
}

interface Row {
  id: string;
  platform: "instagram" | "tiktok";
  url: string;
  caption: string | null;
  format: string;
  posted_at: string;
  theme: InspoTheme | null;
  theme_set_by_founder: boolean;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  save_rate: number | null;
  share_rate: number | null;
  updated_at: string;
}

const THEME_LABEL = Object.fromEntries(INSPO_THEMES.map((t) => [t.key, t.label]));
const FORMAT_LABEL: Record<string, string> = {
  video: "TikTok video",
  slideshow: "TikTok slideshow",
  reel: "Instagram reel",
  carousel: "Instagram carousel",
  image: "Instagram image",
};

function verdictOf(posts: number, medianIndex: number | null): Verdict {
  if (posts < MIN_POSTS || medianIndex === null) return "too-few";
  if (medianIndex >= 1.25) return "working";
  if (medianIndex <= 0.8) return "not-working";
  return "average";
}

function group(
  posts: OwnPostRow[],
  keyOf: (p: OwnPostRow) => string | null,
  labelOf: (k: string) => string,
  libraryRate?: (k: string) => number | null
): OwnGroupRow[] {
  const map = new Map<string, OwnPostRow[]>();
  for (const p of posts) {
    const k = keyOf(p);
    if (!k) continue;
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(p);
  }
  const rank: Record<Verdict, number> = { working: 0, average: 1, "not-working": 2, "too-few": 3 };
  return Array.from(map.entries())
    .map(([key, list]) => {
      const medianIndex = median(list.map((p) => p.viewsIndex).filter((v): v is number => v !== null));
      return {
        key,
        label: labelOf(key),
        posts: list.length,
        medianIndex,
        medianSaveRate: median(list.map((p) => p.saveRate).filter((v): v is number => v !== null)),
        libraryMedianSaveRate: libraryRate?.(key) ?? null,
        verdict: verdictOf(list.length, medianIndex),
      };
    })
    .sort((a, b) => rank[a.verdict] - rank[b.verdict] || (b.medianIndex ?? 0) - (a.medianIndex ?? 0));
}

export async function getOwnPosts(sort: OwnSort): Promise<OwnPostsData> {
  const supabase = createSupabaseServerClient();
  const [postsRes, snapsRes, insights] = await Promise.all([
    supabase
      .from("hq_own_posts")
      .select(
        "id, platform, url, caption, format, posted_at, theme, theme_set_by_founder, views, likes, comments, shares, saves, save_rate, share_rate, updated_at"
      )
      .order("posted_at", { ascending: false })
      .limit(1000),
    // The first snapshot taken at 7+ days old is the post's "day 7" number.
    supabase
      .from("hq_own_post_snapshots")
      .select("post_id, age_days, views")
      .gte("age_days", 7)
      .lte("age_days", 10)
      .order("age_days")
      .limit(5000),
    getInsights({ group: "all", slidesOnly: false, sort: "proven" }),
  ]);
  if (postsRes.error) throw new Error(`Failed to load own posts: ${postsRes.error.message}`);
  if (snapsRes.error) throw new Error(`Failed to load own post snapshots: ${snapsRes.error.message}`);

  const rows = (postsRes.data ?? []) as unknown as Row[];
  const day7 = new Map<string, number | null>();
  for (const s of (snapsRes.data ?? []) as { post_id: string; views: number | null }[]) {
    if (!day7.has(s.post_id)) day7.set(s.post_id, s.views);
  }

  const platformMedian = {
    instagram: median(rows.filter((r) => r.platform === "instagram" && r.views !== null).map((r) => Number(r.views))),
    tiktok: median(rows.filter((r) => r.platform === "tiktok" && r.views !== null).map((r) => Number(r.views))),
  };

  const posts: OwnPostRow[] = rows.map((r) => {
    const base = platformMedian[r.platform];
    return {
      id: r.id,
      platform: r.platform,
      url: r.url,
      caption: r.caption,
      format: r.format,
      postedAt: r.posted_at,
      theme: r.theme,
      themeSetByFounder: r.theme_set_by_founder,
      views: r.views === null ? null : Number(r.views),
      likes: r.likes === null ? null : Number(r.likes),
      comments: r.comments === null ? null : Number(r.comments),
      shares: r.shares === null ? null : Number(r.shares),
      saves: r.saves === null ? null : Number(r.saves),
      saveRate: r.save_rate === null ? null : Number(r.save_rate),
      shareRate: r.share_rate === null ? null : Number(r.share_rate),
      viewsIndex: r.views !== null && base ? Number(r.views) / base : null,
      views7d: day7.get(r.id) ?? null,
      hook: hookOf(r.caption),
    };
  });

  const libraryByTheme = new Map(insights.themes.map((t) => [t.theme, t.medianSaveRate]));
  const settled = posts.filter((p) => Date.now() - Date.parse(p.postedAt) >= MIN_AGE_DAYS * 86_400_000);

  const sorted = [...posts];
  if (sort === "views") sorted.sort((a, b) => (b.views ?? -1) - (a.views ?? -1));
  if (sort === "index") sorted.sort((a, b) => (b.viewsIndex ?? -1) - (a.viewsIndex ?? -1));
  if (sort === "saves") sorted.sort((a, b) => (b.saveRate ?? -1) - (a.saveRate ?? -1));

  return {
    posts: sorted,
    counts: {
      instagram: posts.filter((p) => p.platform === "instagram").length,
      tiktok: posts.filter((p) => p.platform === "tiktok").length,
    },
    medianViews: platformMedian,
    medianSaveRate: median(posts.map((p) => p.saveRate).filter((v): v is number => v !== null)),
    byTheme: group(
      settled,
      (p) => p.theme,
      (k) => THEME_LABEL[k] ?? k,
      (k) => libraryByTheme.get(k as InspoTheme) ?? null
    ),
    byHook: group(settled, (p) => p.hook, (k) => HOOK_LABELS[k] ?? k),
    byFormat: group(settled, (p) => p.format, (k) => FORMAT_LABEL[k] ?? k),
    lastSynced: rows.reduce<string | null>((max, r) => (!max || r.updated_at > max ? r.updated_at : max), null),
  };
}
