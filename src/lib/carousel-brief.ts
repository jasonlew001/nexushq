import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  INSPO_BIG_ACCOUNT_FOLLOWERS,
  INSPO_PHOTO_TERMS,
  INSPO_THEMES,
  NEXUS_DESIGN_SYSTEM_URL,
  type InspoTheme,
} from "@/lib/constants";
import { getInsights, median } from "@/lib/data/inspiration-insights";

if (typeof window !== "undefined") {
  throw new Error("carousel-brief.ts must never be imported client-side");
}

// A copy-paste brief for a claude.ai window that has the Nexus design
// system: everything the library and our own posts say about a theme (or one
// post to remake), plus the guardrails. No model call here; the Claude
// window does the writing and builds the Design canvas.

const pct = (r: number | null) => (r === null ? "n/a" : `${(r * 100).toFixed(2)}%`);
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const clip = (s: string | null, n: number) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t || "(no caption)";
};

interface ExampleRow {
  url: string;
  caption: string | null;
  creator_username: string | null;
  format: string;
  views: number | null;
  saves: number | null;
  save_rate: number | null;
  slide_count: number | null;
}

async function examplesFor(theme: InspoTheme): Promise<ExampleRow[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hq_inspo_posts")
    .select("url, caption, creator_username, format, views, saves, save_rate, slide_count")
    .eq("theme", theme)
    .eq("hidden", false)
    .eq("is_personal", false)
    .in("format", ["slideshow", "carousel"])
    .or(`creator_followers.is.null,creator_followers.lte.${INSPO_BIG_ACCOUNT_FOLLOWERS}`)
    .not("saves", "is", null)
    .order("saves", { ascending: false })
    .limit(5);
  if (error) throw new Error(`Failed to load examples: ${error.message}`);
  return (data ?? []) as ExampleRow[];
}

// Our posts on this theme, if own-post tracking (sql/010) is live.
async function ourResultsFor(theme: InspoTheme): Promise<string[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hq_own_posts")
    .select("platform, caption, views, save_rate")
    .eq("theme", theme)
    .order("posted_at", { ascending: false })
    .limit(10);
  if (error || !data?.length) return [];
  const rows = data as { platform: string; caption: string | null; views: number | null; save_rate: number | null }[];
  const med = median(rows.map((r) => r.views ?? 0));
  return [
    `We've posted ${rows.length} on this theme (median ${compact.format(med ?? 0)} views). Recent:`,
    ...rows.slice(0, 5).map((r) => `- ${r.platform}: "${clip(r.caption, 80)}" — ${compact.format(r.views ?? 0)} views, save rate ${pct(r.save_rate)}`),
    "Don't repeat a hook we've already used; build on whichever of these did best.",
  ];
}

function guardrails(): string[] {
  return [
    "## How to build it",
    `Use the Nexus Golf Recruiting design system (${NEXUS_DESIGN_SYSTEM_URL}). Read its README.md and carousels.md first and follow them exactly:`,
    "- 6 slides: cover (photo + hook headline), 4 numbered body slides, bridge end card.",
    "- Body copy: 3 to 4 lines per slide, each line 36 characters or fewer. No em dashes, no emoji, sentence case.",
    "- Build Instagram (1080 x 1350) and TikTok (1080 x 1920) rows on one new Design canvas.",
    '- The bridge ties this topic to Nexus and closes with "Try Nexus free" + "LINK IN BIO". Never call the product free.',
    "- Never invent a statistic. Use a number only with a real source you can name; otherwise make the point without one.",
    "- The reference posts are for structure and angle only. Write our own copy; don't reuse their wording.",
    "",
    "## Deliver",
    "1. The Design canvas with both rows.",
    "2. Instagram caption (open with a save prompt, recap the 4 points, bridge line, \"Try Nexus free, link in bio.\") + 5 hashtags.",
    "3. TikTok caption under ~120 characters with the save prompt + 5–6 hashtags, and a 3–5 word photo-mode title.",
    "4. Two or three sound suggestions.",
    "5. A shot list mapping a photo to each slide (search terms above). If you can't fetch photos yourself, give me the list and I'll attach them.",
  ];
}

async function patternLines(): Promise<string[]> {
  const insights = await getInsights({ group: "all", slidesOnly: true, sort: "proven" });
  const hooks = insights.hooks.filter((h) => h.posts >= 10 && h.key !== "other" && h.key !== "tags").slice(0, 3);
  const slides = (key: string) => insights.slideCounts.find((b) => b.key === key);
  const [mid, long, one] = [slides("4-6"), slides("7-9"), slides("1")];
  return [
    "## Patterns that work across the library (slideshows, personal posts and big accounts excluded)",
    `- Typical slideshow save rate: ${pct(insights.baselineSaveRate)}.`,
    ...hooks.map((h) => `- Captions that open as "${h.label}": ${pct(h.medianSaveRate)} save rate (${h.creators} creators).`),
    mid && long
      ? `- Slide count: 4–6 slides save at ${pct(mid.medianSaveRate)} and 7–9 at ${pct(long.medianSaveRate)}, vs ${pct(one?.medianSaveRate ?? null)} for a single slide; our 6-slide format fits.`
      : "",
    insights.sounds.length
      ? `- Sounds on the best-saving slideshows: ${insights.sounds.slice(0, 5).map((s) => s.sound).join("; ")}.`
      : "",
  ].filter(Boolean);
}

export async function buildThemeBrief(theme: InspoTheme): Promise<string> {
  const meta = INSPO_THEMES.find((t) => t.key === theme);
  if (!meta) throw new Error("Unknown theme");

  const [all, examples, ours, patterns] = await Promise.all([
    getInsights({ group: "all", slidesOnly: false, sort: "proven" }),
    examplesFor(theme),
    ourResultsFor(theme),
    patternLines(),
  ]);
  const row = all.themes.find((t) => t.theme === theme);
  const ratio = row?.medianSaveRate && all.baselineSaveRate ? row.medianSaveRate / all.baselineSaveRate : null;

  return [
    `# Carousel brief: ${meta.label}`,
    "",
    "Make a Nexus Golf Recruiting carousel on this theme. Nexus helps junior golfers (14–18) and their parents find a realistic college golf fit. The audience is junior golfers and golf parents.",
    "",
    "## Why this theme",
    row
      ? `- ${row.posts} posts from ${row.creators} creators in our library; ${row.provenCreators} different small and mid-size creators got a 100K+ view post from it.`
      : "- Not enough library data on this theme yet.",
    row ? `- Median save rate ${pct(row.medianSaveRate)}${ratio ? ` (${ratio.toFixed(1)}× the library's ${pct(all.baselineSaveRate)})` : ""}; share rate ${pct(row.medianShareRate)}.` : "",
    row?.slideSaveRate != null ? `- Slideshows on this theme save at ${pct(row.slideSaveRate)} vs ${pct(row.videoSaveRate)} for videos.` : "",
    "",
    "## Most-saved slideshows on this theme (reference for structure only)",
    ...(examples.length
      ? examples.map(
          (e, i) =>
            `${i + 1}. @${e.creator_username ?? "unknown"}: ${compact.format(e.views ?? 0)} views, ${compact.format(e.saves ?? 0)} saves (${pct(e.save_rate)})${e.slide_count ? `, ${e.slide_count} slides` : ""}\n   "${clip(e.caption, 300)}"\n   ${e.url}`
        )
      : ["(No slideshows on this theme yet; lean on the patterns below.)"]),
    "",
    ...(ours.length ? ["## Our results on this theme", ...ours, ""] : []),
    ...patterns,
    "",
    "## Photo search terms (Unsplash / Pexels, free license)",
    ...(INSPO_PHOTO_TERMS[theme] ?? ["junior golfer on course", "golf course at sunrise", "golfer looking out over fairway"]).map((t) => `- ${t}`),
    "- Cover: a reaction or emotion beats a clean swing. Bridge: a forward-looking vista.",
    "",
    ...guardrails(),
  ]
    .filter((l) => l !== "")
    .join("\n")
    .replace(/\n(## )/g, "\n\n$1");
}

export async function buildPostBrief(postId: string): Promise<string> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hq_inspo_posts")
    .select("url, caption, creator_username, creator_followers, format, views, likes, saves, shares, save_rate, slide_count, theme, hashtags, sound")
    .eq("id", postId)
    .single();
  if (error || !data) throw new Error("Post not found");
  const p = data as ExampleRow & {
    creator_followers: number | null;
    likes: number | null;
    shares: number | null;
    theme: InspoTheme | null;
    hashtags: string[];
    sound: string | null;
  };
  const meta = INSPO_THEMES.find((t) => t.key === p.theme);
  const [ours, patterns] = await Promise.all([p.theme ? ourResultsFor(p.theme) : Promise.resolve([]), patternLines()]);

  return [
    `# Carousel brief: remake this ${p.format} for Nexus`,
    "",
    "Make a Nexus Golf Recruiting carousel that borrows this post's format and angle, aimed at junior golfers (14–18) and golf parents. Nexus helps them find a realistic college golf fit.",
    "",
    "## The post",
    `- @${p.creator_username ?? "unknown"} (${compact.format(p.creator_followers ?? 0)} followers): ${compact.format(p.views ?? 0)} views, ${compact.format(p.likes ?? 0)} likes, ${compact.format(p.saves ?? 0)} saves, ${compact.format(p.shares ?? 0)} shares (save rate ${pct(p.save_rate)})${p.slide_count ? `, ${p.slide_count} slides` : ""}.`,
    meta ? `- Theme: ${meta.label}.` : "",
    `- Caption: "${clip(p.caption, 600)}"`,
    p.hashtags.length ? `- Hashtags: ${p.hashtags.slice(0, 12).map((h) => `#${h}`).join(" ")}` : "",
    p.sound ? `- Sound: ${p.sound}` : "",
    `- Link: ${p.url}`,
    "",
    "Open the link and work out why it got saved: the promise in the hook, how each slide lands one idea, what makes it feel useful. Keep that structure; write all-new copy in the Nexus voice. If it's a golf-skill post, bridge it to recruiting naturally (better scores and smarter practice feed a realistic college fit).",
    "",
    ...(ours.length ? ["## Our results on this theme", ...ours, ""] : []),
    ...patterns,
    "",
    "## Photo search terms (Unsplash / Pexels, free license)",
    ...((p.theme && INSPO_PHOTO_TERMS[p.theme]) || ["junior golfer on course", "golf course at sunrise", "golfer looking out over fairway"]).map((t) => `- ${t}`),
    "",
    ...guardrails(),
  ]
    .filter((l) => l !== "")
    .join("\n")
    .replace(/\n(## )/g, "\n\n$1");
}
