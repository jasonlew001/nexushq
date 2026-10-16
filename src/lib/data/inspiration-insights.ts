import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  INSPO_BIG_ACCOUNT_FOLLOWERS,
  INSPO_PROVEN_VIEWS,
  INSPO_THEMES,
  type InspoTheme,
} from "@/lib/constants";

// "What can we copy?" — aggregates over the library, leaving out what can't
// be replicated: personal posts (POV, diaries, "I committed"), big accounts
// (reach from the name), hidden posts, and anything without a view count
// (Instagram carousels) since every rate here is per view. Medians, not
// means, so one 20M-view outlier can't carry a theme.

export type InsightsGroup = "all" | "golf" | "recruiting";

export interface InsightsFilters {
  group: InsightsGroup;
  slidesOnly: boolean;
  // proven = reach across many creators; saves = median save rate (themes
  // with fewer than 10 posts sink, too thin to trust)
  sort: "proven" | "saves";
}

export function parseInsightsFilters(params: Record<string, string | string[] | undefined>): InsightsFilters {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const g = first(params.group);
  return {
    group: g === "golf" || g === "recruiting" ? g : "all",
    slidesOnly: first(params.slides) === "1",
    sort: first(params.sort) === "saves" ? "saves" : "proven",
  };
}

export interface ExamplePost {
  id: string;
  url: string;
  caption: string | null;
  creator: string | null;
  format: string;
  views: number;
  saves: number | null;
  slideCount: number | null;
}

export interface ThemeRow {
  theme: InspoTheme;
  label: string;
  group: "golf" | "recruiting";
  posts: number;
  creators: number;
  provenCreators: number; // distinct creators with a post >= INSPO_PROVEN_VIEWS
  medianViews: number;
  medianSaveRate: number | null;
  medianShareRate: number | null;
  slideSaveRate: number | null; // median save rate, slideshows/carousels only
  videoSaveRate: number | null;
  slideCount: number; // slideshow/carousel posts in this theme
  examples: ExamplePost[];
}

export interface BucketRow {
  key: string;
  label: string;
  posts: number;
  creators: number;
  medianViews: number;
  medianSaveRate: number | null;
}

export interface SoundRow {
  sound: string;
  posts: number;
  creators: number;
}

export interface InsightsData {
  analyzed: number;
  excludedPersonal: number;
  excludedBig: number;
  excludedNoViews: number;
  baselineSaveRate: number | null;
  themes: ThemeRow[];
  hooks: BucketRow[];
  slideCounts: BucketRow[];
  captionLengths: BucketRow[];
  sounds: SoundRow[];
}

interface Row {
  id: string;
  url: string;
  platform: string;
  format: string;
  theme: InspoTheme | null;
  is_personal: boolean;
  creator_username: string | null;
  creator_followers: number | null;
  caption: string | null;
  views: number | null;
  saves: number | null;
  save_rate: number | null;
  share_rate: number | null;
  slide_count: number | null;
  sound: string | null;
}

const SLIDE_FORMATS = new Set(["slideshow", "carousel", "image"]);
const THEME_META = new Map<string, (typeof INSPO_THEMES)[number]>(INSPO_THEMES.map((t) => [t.key, t]));

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const rates = (rows: Row[], key: "save_rate" | "share_rate") =>
  rows.map((r) => r[key]).filter((v): v is number => v !== null).map(Number);

function bucket(key: string, label: string, rows: Row[]): BucketRow {
  return {
    key,
    label,
    posts: rows.length,
    creators: new Set(rows.map((r) => r.creator_username)).size,
    medianViews: median(rows.map((r) => r.views ?? 0)) ?? 0,
    medianSaveRate: median(rates(rows, "save_rate")),
  };
}

// How a caption opens. First match wins; checked on the first ~100 chars.
// Shared with the own-posts page so both sides bucket captions the same way.
export const HOOKS: { key: string; label: string; re: RegExp }[] = [
  { key: "save", label: "Save prompt (“Save this for…”)", re: /^\W*(save|bookmark)\b|save (this|for)/i },
  { key: "number", label: "Numbered list (“5 drills…”)", re: /^\W*(top )?\d+\s+(\w+\s+)?(tips?|things|ways|drills?|mistakes|steps|reasons|keys|rules|signs|habits|questions|lessons)/i },
  { key: "how", label: "How-to (“How to…”)", re: /^\W*how (to|i|you)\b/i },
  { key: "stop", label: "Stop / don't (“Stop doing…”)", re: /^\W*(stop|don'?t|never|quit|avoid)\b/i },
  { key: "if", label: "Callout (“If you…”)", re: /^\W*(if you|when you|most (golfers|players|people))\b/i },
  { key: "this", label: "This / these (“This drill…”)", re: /^\W*(this|these|here'?s)\b/i },
  { key: "question", label: "Question", re: /^[^.!\n#]{3,90}\?/ },
  { key: "tags", label: "Hashtags only", re: /^\s*#/ },
];

export function hookOf(caption: string | null): string {
  const opening = (caption ?? "").slice(0, 100);
  return HOOKS.find((h) => h.re.test(opening))?.key ?? "other";
}

export const HOOK_LABELS: Record<string, string> = Object.fromEntries([
  ...HOOKS.map((h) => [h.key, h.label]),
  ["other", "Other / statement"],
]);

// cache(): a brief asks for insights twice (all formats + slideshows only);
// one library read per request instead of two.
const fetchAll = cache(async (): Promise<Row[]> => {
  const supabase = createSupabaseServerClient();
  const rows: Row[] = [];
  // PostgREST caps a response at 1000 rows; page through.
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("hq_inspo_posts")
      .select(
        "id, url, platform, format, theme, is_personal, creator_username, creator_followers, caption, views, saves, save_rate, share_rate, slide_count, sound"
      )
      .eq("hidden", false)
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(`Failed to load posts for insights: ${error.message}`);
    rows.push(...((data ?? []) as unknown as Row[]));
    if ((data ?? []).length < 1000) break;
  }
  return rows;
});

export async function getInsights(filters: InsightsFilters): Promise<InsightsData> {
  const all = await fetchAll();

  let excludedPersonal = 0;
  let excludedBig = 0;
  let excludedNoViews = 0;
  const rows = all.filter((r) => {
    const meta = r.theme ? THEME_META.get(r.theme) : undefined;
    if (filters.group !== "all" && meta?.group !== filters.group) return false;
    if (filters.slidesOnly && !SLIDE_FORMATS.has(r.format)) return false;
    if (r.is_personal) return (excludedPersonal++, false);
    if ((r.creator_followers ?? 0) > INSPO_BIG_ACCOUNT_FOLLOWERS) return (excludedBig++, false);
    if (r.views === null) return (excludedNoViews++, false);
    return true;
  });

  const byTheme = new Map<InspoTheme, Row[]>();
  for (const r of rows) {
    if (!r.theme || !THEME_META.has(r.theme)) continue;
    const list = byTheme.get(r.theme) ?? [];
    list.push(r);
    byTheme.set(r.theme, list);
  }

  const themes: ThemeRow[] = Array.from(byTheme.entries()).map(([theme, list]) => {
    const meta = THEME_META.get(theme)!;
    const slides = list.filter((r) => SLIDE_FORMATS.has(r.format));
    const videos = list.filter((r) => !SLIDE_FORMATS.has(r.format));
    return {
      theme,
      label: meta.label,
      group: meta.group,
      posts: list.length,
      creators: new Set(list.map((r) => r.creator_username)).size,
      provenCreators: new Set(
        list.filter((r) => (r.views ?? 0) >= INSPO_PROVEN_VIEWS).map((r) => r.creator_username)
      ).size,
      medianViews: median(list.map((r) => r.views ?? 0)) ?? 0,
      medianSaveRate: median(rates(list, "save_rate")),
      medianShareRate: median(rates(list, "share_rate")),
      slideSaveRate: slides.length >= 3 ? median(rates(slides, "save_rate")) : null,
      videoSaveRate: videos.length >= 3 ? median(rates(videos, "save_rate")) : null,
      slideCount: slides.length,
      examples: [...list]
        .sort((a, b) => (b.saves ?? 0) - (a.saves ?? 0))
        .slice(0, 3)
        .map((r) => ({
          id: r.id,
          url: r.url,
          caption: r.caption,
          creator: r.creator_username,
          format: r.format,
          views: r.views ?? 0,
          saves: r.saves,
          slideCount: r.slide_count,
        })),
    };
  });
  if (filters.sort === "saves") {
    const thin = (t: ThemeRow) => (t.posts < 10 ? 1 : 0);
    themes.sort((a, b) => thin(a) - thin(b) || (b.medianSaveRate ?? 0) - (a.medianSaveRate ?? 0));
  } else {
    // Repeatable first: proven by the most different creators, then save rate.
    themes.sort((a, b) => b.provenCreators - a.provenCreators || (b.medianSaveRate ?? 0) - (a.medianSaveRate ?? 0));
  }

  const hookGroups = new Map<string, Row[]>();
  for (const r of rows) {
    const key = hookOf(r.caption);
    if (!hookGroups.has(key)) hookGroups.set(key, []);
    hookGroups.get(key)!.push(r);
  }
  const hooks = [...HOOKS, { key: "other", label: "Other / statement", re: /./ }]
    .map((h) => bucket(h.key, h.label, hookGroups.get(h.key) ?? []))
    .filter((b) => b.posts >= 5)
    .sort((a, b) => (b.medianSaveRate ?? 0) - (a.medianSaveRate ?? 0));

  const slideRows = rows.filter((r) => SLIDE_FORMATS.has(r.format) && r.slide_count);
  const SLIDE_BUCKETS: [string, string, (n: number) => boolean][] = [
    ["1", "1 slide", (n) => n === 1],
    ["2-3", "2–3 slides", (n) => n >= 2 && n <= 3],
    ["4-6", "4–6 slides", (n) => n >= 4 && n <= 6],
    ["7-9", "7–9 slides", (n) => n >= 7 && n <= 9],
    ["10+", "10+ slides", (n) => n >= 10],
  ];
  const slideCounts = SLIDE_BUCKETS.map(([key, label, test]) =>
    bucket(key, label, slideRows.filter((r) => test(r.slide_count!)))
  );

  const LEN_BUCKETS: [string, string, (n: number) => boolean][] = [
    ["xs", "Under 60 characters", (n) => n < 60],
    ["s", "60–150", (n) => n >= 60 && n < 150],
    ["m", "150–300", (n) => n >= 150 && n < 300],
    ["l", "300+", (n) => n >= 300],
  ];
  const captionLengths = LEN_BUCKETS.map(([key, label, test]) =>
    bucket(key, label, rows.filter((r) => test((r.caption ?? "").length)))
  );

  // Sounds behind the best-saving slideshows (top quarter by save rate).
  const slideRates = rates(slideRows, "save_rate").sort((a, b) => a - b);
  const p75 = slideRates[Math.floor(slideRates.length * 0.75)] ?? Infinity;
  const soundMap = new Map<string, Row[]>();
  for (const r of slideRows) {
    if (r.save_rate === null || Number(r.save_rate) < p75 || !r.sound) continue;
    const name = r.sound.trim();
    // "original sound" in any language is the creator's own audio, not a pick.
    if (/original|originalton|оригинальный|オリジナル|原声|suono|son orig/i.test(name)) continue;
    if (!soundMap.has(name)) soundMap.set(name, []);
    soundMap.get(name)!.push(r);
  }
  const sounds = Array.from(soundMap.entries())
    .map(([sound, list]) => ({ sound, posts: list.length, creators: new Set(list.map((r) => r.creator_username)).size }))
    .filter((s) => s.creators >= 2)
    .sort((a, b) => b.creators - a.creators || b.posts - a.posts)
    .slice(0, 12);

  return {
    analyzed: rows.length,
    excludedPersonal,
    excludedBig,
    excludedNoViews,
    baselineSaveRate: median(rates(rows, "save_rate")),
    themes,
    hooks,
    slideCounts,
    captionLengths,
    sounds,
  };
}
