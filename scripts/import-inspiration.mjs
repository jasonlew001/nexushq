// Inspiration library import — pulls viral golf / recruiting content through
// Monid (pay-per-call scraper gateway) and upserts it into hq_inspo_posts.
//
//   node scripts/import-inspiration.mjs --dry-run          # plan + cost estimate, spends nothing
//   node scripts/import-inspiration.mjs --budget=4.5       # real run, hard spend cap in USD
//   node scripts/import-inspiration.mjs --from-raw=<dir>   # re-normalize a saved run, spends nothing
//   node scripts/import-inspiration.mjs --resume=<dir>     # reuse a saved run, pay only for new jobs
//
// Reads MONID_API_KEY, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from
// .env.local. Raw scraper output is saved under scripts/.inspo-raw/<run>/
// (gitignored) so a normalizer fix never means paying for the data twice.
// Edit the lists below to change what gets pulled.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { PERSONAL_RE, themeOf } from "../src/lib/theme-rules.mjs";

// ---------------------------------------------------------------------------
// What to search for. topic drives the toggle chips on /inspiration.
// ---------------------------------------------------------------------------
const SEARCHES = {
  recruiting: [
    "college golf recruiting", "how to get recruited golf", "junior golf", "college golf",
    "d1 golf commit", "golf scholarship", "high school golf", "college golf day in the life",
    "junior golf tournament", "college golf coach", "junior golfer", "girls golf",
    "college golf signing day", "golf recruiting tips", "ajga",
  ],
  adjacent: [
    "college recruiting tips", "d1 commit", "how to get recruited", "athletic scholarship",
    "recruiting video tips", "sports parents", "college soccer recruiting", "baseball recruiting",
    "volleyball recruiting", "college decision", "signing day", "student athlete",
    "ncaa recruiting", "college tennis recruiting", "recruiting email to coaches",
  ],
  general: [
    "golf tips", "golf swing", "golf drills", "golf meme", "golf practice", "golf hacks",
    "short game tips", "putting tips", "golf slideshow", "golf motivation", "golf mental game",
    "golf funny", "golf course vlog", "driver tips", "golf workout",
  ],
};

// Copy-ready advice slideshows ("5 drills to fix your slice") — TikTok photo
// search only, paged deeper (~100 results/term before TikTok stops paging).
// Everything found here counts as advice even if the caption is just
// hashtags, since the tip text lives in the slide images.
const ADVICE_SEARCHES = {
  general: [
    "golf tips", "golf swing tips", "beginner golf tips", "driver tips", "iron tips",
    "wedge tips", "chipping tips", "pitching tips", "putting tips", "bunker tips",
    "short game tips", "golf drills", "putting drills", "chipping drills", "golf practice routine",
    "golf practice plan", "range session drills", "golf mistakes", "golf slice fix", "golf hook fix",
    "how to break 80", "how to break 90", "how to break 100", "lower your handicap", "golf course management",
    "golf strategy", "golf mental tips", "golf swing thoughts", "golf tempo", "golf grip tips",
    "golf posture", "golf setup tips", "golf rotation", "ball striking tips", "more distance golf",
    "golf fitness", "golf stretches", "golf warm up", "golf rules tips", "golf etiquette",
    "golf hacks", "golf lesson", "golf advice", "golf scoring tips", "tournament golf tips",
    "golf pre shot routine", "golf club tips", "things i wish i knew golf",
  ],
  recruiting: [
    "college golf recruiting tips", "junior golf tips", "college golf advice", "golf recruiting advice",
    "how to play college golf", "golf scholarship tips", "junior golf tournament tips",
    "emailing college golf coaches", "college golf showcase", "golf recruiting timeline",
  ],
};
const TT_ADVICE_PAGES = 6;

// Instagram hashtag "top posts" — the only cheap source of viral carousels.
const IG_HASHTAGS = {
  recruiting: [
    "collegegolf", "juniorgolf", "golfrecruiting", "collegegolfrecruiting", "d1golf",
    "juniorgolfer", "highschoolgolf", "golfscholarship", "ajga",
  ],
  adjacent: [
    "studentathlete", "collegerecruiting", "d1commit", "athleticscholarship",
    "sportsparents", "recruitingtips",
  ],
  general: [
    "golftips", "golfswing", "golfdrills", "golfmemes", "golfinstruction", "golfcoach",
    // advice-heavy tags — mostly tip carousels
    "golftipsforbeginners", "golftip", "golflessons", "puttingtips", "chippingtips", "drivertips",
    "golfdrill", "golfpractice", "golfhacks", "shortgame", "golfswingtips", "golfadvice",
    "golfbeginner", "coursemanagement", "golfmentalgame", "golffitness",
  ],
};

// Recruiting services + college-golf coaches/creators found in the test
// searches. Each handle is tried on both platforms (a miss costs ~nothing).
const COMPETITORS = [
  "fairvuegolf", "gsd_golf", "ncsa_sports", "nextgoal.college", "collegegolfx",
  "propath.golf", "upgame_golf", "juniorgolfrecruit", "projectcutlinegolf",
  "thegolfparent", "coachasarchgolf", "instacoachapp",
];

const EXCLUDE_CREATORS = new Set(["nexusgolfrecruiting"]); // our own account lives on /social

// Quality floors — below these a post isn't "viral" enough to learn from.
const MIN_VIEWS = 10_000;
const MIN_LIKES_NO_VIEWS = 300; // carousels/images have no public view count
const COMPETITOR_MIN_VIEWS = 2_000;
const COMPETITOR_MIN_LIKES = 100;

const TT_VIDEOS_PER_SEARCH = 80;
const TT_PHOTO_PAGES = 3; // 20 slideshows per page
const COMPETITOR_POSTS = 40;
const CONCURRENCY = 6;

// Per-job cost estimates (USD) from Monid's listed prices — used for the
// dry-run total and to stop launching jobs before the budget is crossed.
const EST = {
  ttVideos: TT_VIDEOS_PER_SEARCH * 0.0003,
  igReels: 0.002,
  igTop: 0.001,
  ttProfile: COMPETITOR_POSTS * 0.0003,
  igProfile: COMPETITOR_POSTS * 0.0016,
  igUser: 0.001,
};

const TOPIC_RANK = { competitor: 4, recruiting: 3, adjacent: 2, general: 1 };

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  })
);
const DRY_RUN = Boolean(args["dry-run"]);
const FROM_RAW = typeof args["from-raw"] === "string" ? args["from-raw"] : null;
// --resume=<dir>: reuse that run's saved output and only pay for jobs it lacks
// (e.g. after adding search terms).
const RESUME = typeof args.resume === "string" ? args.resume : null;
const BUDGET = Number(args.budget ?? 4.5);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(ROOT, ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    })
);
for (const k of ["MONID_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
  if (!env[k]) throw new Error(`${k} missing from .env.local`);
}

const rawDir = FROM_RAW || RESUME
  ? path.resolve(FROM_RAW || RESUME)
  : path.join(ROOT, "scripts", ".inspo-raw", new Date().toISOString().replace(/[:.]/g, "-"));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ---------------------------------------------------------------------------
// Monid client + budget guard
// ---------------------------------------------------------------------------
let spent = 0; // actual, from completed runs
let reserved = 0; // estimates of in-flight jobs

class BudgetExceeded extends Error {}

function reserve(est) {
  if (spent + reserved + est > BUDGET) throw new BudgetExceeded();
  reserved += est;
}

const TERMINAL = new Set(["COMPLETED", "FAILED", "BLOCKED", "STOPPED", "TIMED_OUT"]);

async function monid(provider, endpoint, input) {
  const headers = { Authorization: `Bearer ${env.MONID_API_KEY}`, "Content-Type": "application/json" };
  const res = await fetch("https://api.monid.ai/v1/run", {
    method: "POST",
    headers,
    body: JSON.stringify({ provider, endpoint, input }),
  });
  let run = await res.json();
  if (!res.ok && res.status !== 202) throw new Error(`Monid ${res.status}: ${run.message ?? JSON.stringify(run)}`);

  const deadline = Date.now() + 8 * 60_000;
  while (!TERMINAL.has(run.status)) {
    if (Date.now() > deadline) throw new Error(`Monid run ${run.runId} timed out`);
    await sleep(5000);
    run = await (await fetch(`https://api.monid.ai/v1/runs/${run.runId}`, { headers })).json();
  }
  spent += run.cost?.value ?? 0;
  if (run.status !== "COMPLETED") {
    const why = run.status === "BLOCKED" ? " (Monid workspace budget control — adjust at app.monid.ai)" : "";
    throw new Error(`Monid run ${run.runId} ${run.status}${why}`);
  }
  return run.output;
}

// One job = one or more Monid calls whose raw output is saved under `label`.
async function runJob(label, est, fn) {
  const file = path.join(rawDir, `${label}.json`);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  if (FROM_RAW) return null;
  reserve(est);
  try {
    const out = await fn();
    fs.writeFileSync(file, JSON.stringify(out));
    log(`ok   ${label}  (spent $${spent.toFixed(3)})`);
    return out;
  } catch (e) {
    log(`FAIL ${label}: ${e.message}`);
    return null;
  } finally {
    reserved -= est;
  }
}

async function pool(tasks, n) {
  const results = [];
  let next = 0;
  let stopped = false;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (next < tasks.length && !stopped) {
        const i = next++;
        try {
          results[i] = await tasks[i]();
        } catch (e) {
          if (e instanceof BudgetExceeded) {
            if (!stopped) log(`Budget cap $${BUDGET} reached — not launching more jobs.`);
            stopped = true;
          } else throw e;
        }
      }
    })
  );
  return results;
}

// ---------------------------------------------------------------------------
// Normalizers — one per source shape, all producing hq_inspo_posts rows.
// ---------------------------------------------------------------------------
const num = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null; // -1 = hidden likes
};
const iso = (v) => (v ? new Date(typeof v === "number" ? (v < 1e12 ? v * 1000 : v) : v).toISOString() : null);
const tagsFrom = (text) =>
  [...new Set((String(text ?? "").match(/#[\p{L}\p{N}_]+/gu) ?? []).map((t) => t.slice(1).toLowerCase()))];
const cleanTags = (arr) => [...new Set((arr ?? []).map((t) => String(t).replace(/^#/, "").toLowerCase()).filter(Boolean))];

function fromTikTokSearch(i, topic, query) {
  if (!i?.id || !i.postPage) return null;
  return {
    platform: "tiktok",
    // Photo-mode posts come back with an `images` list (and /video/ URLs).
    format: i.images?.length || i.postPage.includes("/photo/") ? "slideshow" : "video",
    external_id: String(i.id),
    url: i.postPage,
    creator_username: i.channel?.username ?? null,
    creator_name: i.channel?.name ?? null,
    creator_followers: num(i.channel?.followers),
    creator_verified: i.channel?.verified ?? null,
    caption: i.title ?? null,
    hashtags: i.hashtags?.length ? cleanTags(i.hashtags) : tagsFrom(i.title),
    views: num(i.views),
    likes: num(i.likes),
    comments: num(i.comments),
    shares: num(i.shares),
    saves: num(i.bookmarks),
    duration_seconds: i.video?.duration ?? null,
    slide_count: i.images?.length || null,
    sound: i.song?.title ? [i.song.title, i.song.artist].filter(Boolean).join(" — ") : null,
    thumbnail_url: i.video?.cover ?? null,
    posted_at: iso(i.uploadedAtFormatted ?? i.uploadedAt),
    topic,
    source_query: query,
  };
}

function fromTikTokPhoto(i, topic, query) {
  if (!i?.id || !i.author?.uniqueId) return null;
  const s = i.statsV2 ?? i.stats ?? {};
  const a = i.authorStatsV2 ?? i.authorStats ?? {};
  const textTags = (i.textExtra ?? []).map((t) => t.hashtagName).filter(Boolean);
  return {
    platform: "tiktok",
    format: "slideshow",
    external_id: String(i.id),
    url: `https://www.tiktok.com/@${i.author.uniqueId}/photo/${i.id}`,
    creator_username: i.author.uniqueId,
    creator_name: i.author.nickname ?? null,
    creator_followers: num(a.followerCount),
    creator_verified: i.author.verified ?? null,
    caption: i.desc ?? null,
    hashtags: textTags.length ? cleanTags(textTags) : tagsFrom(i.desc),
    views: num(s.playCount),
    likes: num(s.diggCount),
    comments: num(s.commentCount),
    shares: num(s.shareCount),
    saves: num(s.collectCount),
    duration_seconds: null,
    slide_count: i.imagePost?.images?.length ?? null,
    sound: i.music?.title ?? null,
    thumbnail_url: i.video?.cover ?? i.imagePost?.cover?.imageURL?.urlList?.[0] ?? null,
    posted_at: iso(Number(i.createTime)),
    topic,
    source_query: query,
  };
}

function fromIgReelSearch(i, topic, query) {
  if (!i?.code) return null;
  const text = i.caption?.text ?? "";
  const music = i.clips_metadata?.music_info?.music_asset_info ?? i.music_metadata?.music_info?.music_asset_info;
  return {
    platform: "instagram",
    format: "reel",
    external_id: i.code,
    url: `https://www.instagram.com/reel/${i.code}/`,
    creator_username: i.user?.username ?? null,
    creator_name: i.user?.full_name ?? null,
    creator_followers: null, // not in search results — looked up below
    creator_verified: i.user?.is_verified ?? null,
    caption: text || null,
    hashtags: i.caption?.hashtags?.length ? cleanTags(i.caption.hashtags) : tagsFrom(text),
    views: num(i.play_count ?? i.ig_play_count),
    likes: num(i.like_count),
    comments: num(i.comment_count),
    shares: num(i.share_count),
    saves: num(i.save_count),
    duration_seconds: i.video_duration ?? null,
    slide_count: null,
    sound: music?.title ? [music.title, music.display_artist].filter(Boolean).join(" — ") : null,
    thumbnail_url: i.thumbnail_url ?? i.image_versions?.items?.[0]?.url ?? null,
    posted_at: iso(i.taken_at),
    topic,
    source_query: query,
  };
}

const IG_GRAPH_FORMAT = { GraphSidecar: "carousel", GraphImage: "image", GraphVideo: "reel" };

function fromIgHashtagTop(n, topic, query) {
  if (!n?.shortcode) return null;
  const text = n.edge_media_to_caption?.edges?.[0]?.node?.text ?? "";
  return {
    platform: "instagram",
    format: IG_GRAPH_FORMAT[n.__typename] ?? "image",
    external_id: n.shortcode,
    url: `https://www.instagram.com/p/${n.shortcode}/`,
    creator_username: n.owner?.username ?? null,
    creator_name: null,
    creator_followers: null,
    creator_verified: null,
    caption: text || null,
    hashtags: tagsFrom(text),
    views: num(n.video_view_count),
    likes: num(n.edge_liked_by?.count ?? n.edge_media_preview_like?.count),
    comments: num(n.edge_media_to_comment?.count),
    shares: null,
    saves: null,
    duration_seconds: null,
    slide_count: n.edge_sidecar_to_children?.edges?.length ?? null,
    sound: null,
    thumbnail_url: n.thumbnail_src ?? n.display_url ?? null,
    posted_at: iso(n.taken_at_timestamp),
    topic,
    source_query: `#${query}`,
    _ownerId: n.owner?.id ?? null, // stripped before upsert
  };
}

const IG_SCRAPER_FORMAT = { Sidecar: "carousel", Image: "image", Video: "reel" };

function fromIgProfilePost(p, topic, query) {
  if (!p?.shortCode) return null;
  return {
    platform: "instagram",
    format: IG_SCRAPER_FORMAT[p.type] ?? "image",
    external_id: p.shortCode,
    url: p.url ?? `https://www.instagram.com/p/${p.shortCode}/`,
    creator_username: p.ownerUsername ?? null,
    creator_name: p.ownerFullName ?? null,
    creator_followers: null,
    creator_verified: null,
    caption: p.caption ?? null,
    hashtags: p.hashtags?.length ? cleanTags(p.hashtags) : tagsFrom(p.caption),
    views: num(p.videoPlayCount ?? p.videoViewCount),
    likes: num(p.likesCount),
    comments: num(p.commentsCount),
    shares: num(p.sharesCount),
    saves: null,
    duration_seconds: p.videoDuration ?? null,
    slide_count: p.childPosts?.length || p.images?.length || null,
    sound: p.musicInfo?.song_name ?? null,
    thumbnail_url: p.displayUrl ?? null,
    posted_at: iso(p.timestamp),
    topic,
    source_query: query,
  };
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------
const slug = (s) => s.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

// TikTok photo-mode (slideshow) search, paged until TikTok stops or `pages`.
function photoSearchJob(label, q, topic, pages, adviceSearch) {
  return {
    label,
    est: pages * 0.001,
    fetch: async () => {
      const items = [];
      let offset = 0;
      let searchId = "";
      for (let page = 0; page < pages; page++) {
        const out = await monid("tikhub", "/api/v1/tiktok/web/fetch_search_photo", {
          queryParams: { keyword: q, count: 20, offset, ...(searchId && { search_id: searchId }) },
        });
        const d = out?.data ?? out ?? {};
        items.push(...(d.item_list ?? []));
        if (!d.has_more) break;
        offset = Number(d.cursor) || offset + 20;
        searchId = d.log_pb?.impr_id ?? searchId;
      }
      return items;
    },
    normalize: (out) =>
      (out ?? []).map((i) => {
        const r = fromTikTokPhoto(i, topic, q);
        return r && { ...r, _adviceSearch: adviceSearch };
      }),
  };
}

function buildJobs() {
  const jobs = []; // { label, est, fetch, normalize }

  for (const [topic, queries] of Object.entries(SEARCHES)) {
    for (const q of queries) {
      jobs.push({
        label: `tt-videos-${slug(q)}`,
        est: EST.ttVideos,
        fetch: () =>
          monid("apify", "/apidojo/tiktok-scraper", {
            body: {
              keywords: [q],
              sortType: "MOST_LIKED",
              // General golf has volume to spare, so keep it recent; the
              // recruiting niches are small enough to need all-time.
              dateRange: topic === "general" ? "LAST_SIX_MONTHS" : "ALL_TIME",
              maxItems: TT_VIDEOS_PER_SEARCH,
            },
          }),
        normalize: (out) => (Array.isArray(out) ? out : []).map((i) => fromTikTokSearch(i, topic, q)),
      });

      jobs.push(photoSearchJob(`tt-photos-${slug(q)}`, q, topic, TT_PHOTO_PAGES, false));

      jobs.push({
        label: `ig-reels-${slug(q)}`,
        est: EST.igReels,
        fetch: () => monid("tikhub", "/api/v1/instagram/v2/search_reels", { queryParams: { keyword: q } }),
        normalize: (out) => (out?.data?.items ?? []).map((i) => fromIgReelSearch(i, topic, q)),
      });
    }
  }

  for (const [topic, queries] of Object.entries(ADVICE_SEARCHES)) {
    for (const q of queries) {
      jobs.push(photoSearchJob(`tt-advice-${slug(q)}`, q, topic, TT_ADVICE_PAGES, true));
    }
  }

  for (const [topic, tags] of Object.entries(IG_HASHTAGS)) {
    for (const tag of tags) {
      jobs.push({
        label: `ig-top-${slug(tag)}`,
        est: EST.igTop,
        fetch: () => monid("tikhub", "/api/v1/instagram/v1/fetch_hashtag_posts", { queryParams: { hashtag: tag } }),
        normalize: (out) =>
          (out?.data?.hashtag?.edge_hashtag_to_top_posts?.edges ?? []).map((e) => fromIgHashtagTop(e.node, topic, tag)),
      });
    }
  }

  for (const handle of COMPETITORS) {
    jobs.push({
      label: `tt-profile-${slug(handle)}`,
      est: EST.ttProfile,
      fetch: () =>
        monid("apify", "/apidojo/tiktok-scraper", {
          body: { startUrls: [`https://www.tiktok.com/@${handle}`], maxItems: COMPETITOR_POSTS },
        }),
      normalize: (out) => (Array.isArray(out) ? out : []).map((i) => fromTikTokSearch(i, "competitor", `@${handle}`)),
    });
    jobs.push({
      label: `ig-profile-${slug(handle)}`,
      est: EST.igProfile,
      fetch: () =>
        monid("apify", "/apify/instagram-post-scraper", {
          body: { username: [handle], resultsLimit: COMPETITOR_POSTS, dataDetailLevel: "detailedData" },
        }),
      normalize: (out) => (Array.isArray(out) ? out : []).map((p) => fromIgProfilePost(p, "competitor", `@${handle}`)),
    });
  }

  return jobs;
}

// Search engines return loosely related posts ("college golf" -> any golf
// meme, "student athlete" -> recipe slideshows). Check the caption+hashtags
// actually match the topic; re-file or drop the rest.
// "driver"/"iron"/"wedge" alone matched car and cast-iron-recipe slideshows,
// so the word golf (or an unambiguous golf term) is required.
const GOLF_RE = /golf|\bputt|birdie|fairway|\bl?pga\b|\bajga\b/i;
const RECRUIT_RE =
  /recruit|\bcommit|scholarship|college|\bd[123]\b|\bnaia\b|\bncaa\b|\bjuco\b|signing day|universit|\boffers?\b|class ?of ?20|\bcoach|high ?school|\bjunior|\bajga\b|varsity|walk.?on|student.?athlete/i;
const SPORT_RE =
  /athlet|sport|recruit|\bd[123]\b|ncaa|naia|juco|varsity|soccer|baseball|softball|volleyball|tennis|football|basketball|lacrosse|swim|track|hockey|wrestl|golf|cheer|rowing|\bxc\b|cross country/i;
const CAR_RE =/volkswagen|\bvw\b|\bgti\b|\bmk ?[1-8]\b|tdi|rebaixad|stance|turbo/i;
const ADVICE_RE =
  /\btips?\b|how to|\bdrills?\b|\bfix(es|ing)?\b|\bmistakes?\b|\blessons?\b|\bsteps?\b|ways to|\bguide\b|checklist|routine|\bdo this\b|\bstop (doing|hitting|making)|beginners?|improve|break (70|80|90|100)|handicap|swing thoughts?|\bhacks?\b|advice|technique|instruction|practice plan|things i wish|what coaches|golftips|golflessons?|golfdrills?|golfinstruction|golfcoach/i;

// Advice = the caption/hashtags say so, or it's a multi-slide post found by
// an advice search (slideshow tip text is in the images, not the caption).
function isAdvice(r) {
  if (ADVICE_RE.test(`${r.caption ?? ""} ${r.hashtags.join(" ")}`)) return true;
  const slides = r.format === "slideshow" || r.format === "carousel";
  return Boolean(r._adviceSearch) && slides && (r.slide_count ?? 2) >= 2;
}

function retopic(r) {
  if (r.topic === "competitor") return r;
  const text = `${r.caption ?? ""} ${r.hashtags.join(" ")}`;
  const golf = GOLF_RE.test(text) && !CAR_RE.test(text);
  const recruit = RECRUIT_RE.test(text);
  if (r.topic === "recruiting") return golf && recruit ? r : golf ? { ...r, topic: "general" } : null;
  // "college"/"offer"/"coach" alone let in internship and job-interview tips.
  if (r.topic === "adjacent") return recruit && SPORT_RE.test(text) ? r : null;
  return golf ? r : null;
}

function passesFloor(r) {
  const comp = r.topic === "competitor";
  if (r.views !== null) return r.views >= (comp ? COMPETITOR_MIN_VIEWS : MIN_VIEWS);
  return (r.likes ?? 0) >= (comp ? COMPETITOR_MIN_LIKES : MIN_LIKES_NO_VIEWS);
}

// Same post found by several searches: keep the best stats and the most
// specific topic, fill any gaps.
function merge(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (out[k] === null || out[k] === undefined || (Array.isArray(out[k]) && !out[k].length)) out[k] = v;
  }
  for (const k of ["views", "likes", "comments", "shares", "saves", "creator_followers"]) {
    if (a[k] !== null && b[k] !== null) out[k] = Math.max(a[k], b[k]);
  }
  if (TOPIC_RANK[b.topic] > TOPIC_RANK[a.topic]) {
    out.topic = b.topic;
    out.source_query = b.source_query;
  }
  out._adviceSearch = Boolean(a._adviceSearch || b._adviceSearch);
  return out;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const jobs = buildJobs();
  const estTotal = jobs.reduce((s, j) => s + j.est, 0);
  log(`${jobs.length} scrape jobs, est. $${estTotal.toFixed(2)} + ~$0.001 per Instagram creator lookup. Budget $${BUDGET}.`);
  if (DRY_RUN) return;

  fs.mkdirSync(rawDir, { recursive: true });
  log(`raw output -> ${path.relative(ROOT, rawDir)}`);

  const outputs = await pool(
    jobs.map((j) => () => runJob(j.label, j.est, j.fetch)),
    CONCURRENCY
  );

  const byKey = new Map();
  const offTopic = new Set(); // failed the relevance check from every search that found it
  let scraped = 0;
  jobs.forEach((j, idx) => {
    if (!outputs[idx]) return;
    for (const raw of j.normalize(outputs[idx])) {
      const r = raw && retopic(raw);
      if (raw && !r) offTopic.add(`${raw.platform}:${raw.external_id}`);
      if (!r) continue;
      scraped++;
      const key = `${r.platform}:${r.external_id}`;
      byKey.set(key, byKey.has(key) ? merge(byKey.get(key), r) : r);
    }
  });

  let rows = [...byKey.values()].filter(
    (r) => passesFloor(r) && !EXCLUDE_CREATORS.has(String(r.creator_username).toLowerCase())
  );
  log(`${scraped} scraped -> ${byKey.size} unique -> ${rows.length} pass floors`);

  // Instagram follower counts (needed for the outlier score). One lookup per
  // creator, cached in the raw dir like everything else.
  const lookups = new Map(); // lookup key -> { username, name, followers, verified }
  for (const r of rows) {
    if (r.platform !== "instagram" || r.creator_followers !== null) continue;
    const key = r.creator_username ? `u-${r.creator_username}` : r._ownerId ? `id-${r._ownerId}` : null;
    if (key) lookups.set(key, null);
  }
  log(`${lookups.size} Instagram creator lookups (est. $${(lookups.size * EST.igUser).toFixed(2)})`);

  const keys = [...lookups.keys()];
  const users = await pool(
    keys.map((key) => () =>
      runJob(`ig-user-${slug(key)}`, EST.igUser, () =>
        key.startsWith("u-")
          ? monid("tikhub", "/api/v1/instagram/v1/fetch_user_info_by_username", { queryParams: { username: key.slice(2) } })
          : monid("tikhub", "/api/v1/instagram/v1/fetch_user_info_by_id", { queryParams: { user_id: key.slice(3) } })
      )
    ),
    CONCURRENCY
  );
  keys.forEach((key, idx) => {
    const o = users[idx];
    const u = o?.data?.user ?? o?.data ?? o;
    if (u?.username) {
      lookups.set(key, {
        username: u.username,
        name: u.full_name ?? null,
        followers: num(u.edge_followed_by?.count ?? u.follower_count),
        verified: u.is_verified ?? null,
      });
    }
  });

  rows = rows
    .map((r) => {
      const key = r.creator_username ? `u-${r.creator_username}` : r._ownerId ? `id-${r._ownerId}` : null;
      const u = key && lookups.get(key);
      const { _ownerId, _adviceSearch, ...rest } = r;
      const row = {
        ...rest,
        is_advice: isAdvice(r),
        theme: themeOf(r),
        is_personal: PERSONAL_RE.test(`${r.caption ?? ""} ${r.hashtags.join(" ")}`),
      };
      if (!u) return row;
      return {
        ...row,
        creator_username: row.creator_username ?? u.username,
        creator_name: row.creator_name ?? u.name,
        creator_followers: row.creator_followers ?? u.followers,
        creator_verified: row.creator_verified ?? u.verified,
      };
    })
    .filter((r) => !EXCLUDE_CREATORS.has(String(r.creator_username).toLowerCase()));

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const fetchedAt = new Date().toISOString();
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500).map((r) => ({ ...r, fetched_at: fetchedAt }));
    const { error } = await supabase.from("hq_inspo_posts").upsert(chunk, { onConflict: "platform,external_id" });
    if (error) throw new Error(`Upsert failed at row ${i}: ${error.message}`);
  }

  // Posts an earlier, looser import let in that now fail relevance: hide
  // rather than delete — reversible, reviewable on the Hidden tab, and any
  // stars/notes on them survive.
  const toHide = [...offTopic].filter((k) => !byKey.has(k));
  let hidden = 0;
  for (const platform of ["tiktok", "instagram"]) {
    const ids = toHide.filter((k) => k.startsWith(`${platform}:`)).map((k) => k.slice(platform.length + 1));
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await supabase
        .from("hq_inspo_posts")
        .update({ hidden: true })
        .eq("platform", platform)
        .eq("hidden", false)
        .in("external_id", ids.slice(i, i + 200))
        .select("id");
      if (error) throw new Error(`Hiding off-topic posts failed: ${error.message}`);
      hidden += data?.length ?? 0;
    }
  }
  if (hidden) log(`hid ${hidden} previously imported posts that no longer pass the relevance check`);

  const tally = (f) => rows.reduce((m, r) => ((m[f(r)] = (m[f(r)] ?? 0) + 1), m), {});
  log(`upserted ${rows.length} rows. Spent $${spent.toFixed(3)} this run.`);
  console.log("by format:", tally((r) => `${r.platform}/${r.format}`));
  console.log("by topic: ", tally((r) => r.topic));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
