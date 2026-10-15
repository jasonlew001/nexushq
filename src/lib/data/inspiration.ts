import { createSupabaseServerClient, getAdminClient } from "@/lib/supabase-server";
import { INSPO_BIG_ACCOUNT_FOLLOWERS, INSPO_PAGE_SIZE, type InspoTopic } from "@/lib/constants";
import { INSPO_SINCE, type InspoFilters, type InspoPlatform } from "@/lib/inspiration-filters";

export interface InspoNote {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface InspoPost {
  id: string;
  platform: InspoPlatform;
  format: "video" | "slideshow" | "reel" | "carousel" | "image";
  url: string;
  creatorUsername: string | null;
  creatorName: string | null;
  creatorFollowers: number | null;
  creatorVerified: boolean | null;
  caption: string | null;
  hashtags: string[];
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  durationSeconds: number | null;
  slideCount: number | null;
  sound: string | null;
  postedAt: string | null;
  topic: InspoTopic;
  sourceQuery: string | null;
  hidden: boolean;
  outlierScore: number | null;
  engagementRate: number | null;
  saveRate: number | null;
  shareRate: number | null;
  favoritedBy: string[];
  boardIds: string[];
  notes: InspoNote[];
}

export interface InspoBoard {
  id: string;
  name: string;
  postCount: number;
}

export interface InspoPage {
  posts: InspoPost[];
  total: number;
  boards: InspoBoard[];
  // user id -> display name, for favorite initials and note authors.
  people: Record<string, string>;
  libraryEmpty: boolean;
}

interface PostRow {
  id: string;
  platform: InspoPlatform;
  format: InspoPost["format"];
  url: string;
  creator_username: string | null;
  creator_name: string | null;
  creator_followers: number | null;
  creator_verified: boolean | null;
  caption: string | null;
  hashtags: string[] | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  duration_seconds: number | null;
  slide_count: number | null;
  sound: string | null;
  posted_at: string | null;
  topic: InspoTopic;
  source_query: string | null;
  hidden: boolean;
  outlier_score: number | null;
  engagement_rate: number | null;
  save_rate: number | null;
  share_rate: number | null;
  hq_inspo_favorites: { user_id: string }[];
  hq_inspo_board_posts: { board_id: string }[];
  hq_inspo_notes: { id: string; author_id: string; body: string; created_at: string }[];
}

const POST_SELECT = `
  id, platform, format, url, creator_username, creator_name, creator_followers,
  creator_verified, caption, hashtags, views, likes, comments, shares, saves,
  duration_seconds, slide_count, sound, posted_at, topic, source_query, hidden,
  outlier_score, engagement_rate, save_rate, share_rate,
  hq_inspo_favorites(user_id),
  hq_inspo_board_posts(board_id),
  hq_inspo_notes(id, author_id, body, created_at)
`;

const SORT_COLUMN: Record<InspoFilters["sort"], string> = {
  outlier: "outlier_score",
  views: "views",
  likes: "likes",
  comments: "comments",
  shares: "shares",
  saves: "saves",
  save_rate: "save_rate",
  share_rate: "share_rate",
  engagement: "engagement_rate",
  recent: "posted_at",
};

const VIDEO_FORMATS = ["video", "reel"];
const SLIDE_FORMATS = ["slideshow", "carousel", "image"];

// PostgREST .or() takes a comma/paren-delimited mini-language — strip
// anything that could break out of the ilike pattern.
function sanitizeSearch(q: string): string {
  return q.replace(/[,()*%\\:"']/g, " ").trim();
}

// Display names for founders: first_name from user_profiles (founders can read
// all profiles via founders_read_all), else the email's local part.
async function resolvePeople(ids: string[]): Promise<Record<string, string>> {
  if (!ids.length) return {};
  const supabase = createSupabaseServerClient();
  const { data } = await supabase.from("user_profiles").select("id, first_name").in("id", ids);
  const people: Record<string, string> = {};
  for (const row of (data ?? []) as { id: string; first_name: string | null }[]) {
    if (row.first_name?.trim()) people[row.id] = row.first_name.trim();
  }
  const missing = ids.filter((id) => !people[id]);
  if (missing.length) {
    const admin = getAdminClient();
    await Promise.all(
      missing.map(async (id) => {
        const { data: u } = await admin.auth.admin.getUserById(id);
        people[id] = u.user?.email?.split("@")[0] ?? "Founder";
      })
    );
  }
  return people;
}

export async function getInspoPage(filters: InspoFilters, currentUserId: string): Promise<InspoPage> {
  const supabase = createSupabaseServerClient();

  const [boardsRes, anyPostRes] = await Promise.all([
    supabase.from("hq_inspo_boards").select("id, name, hq_inspo_board_posts(count)").order("created_at"),
    supabase.from("hq_inspo_posts").select("id").limit(1),
  ]);
  if (boardsRes.error) throw new Error(`Failed to load boards: ${boardsRes.error.message}`);
  if (anyPostRes.error) throw new Error(`Failed to load posts: ${anyPostRes.error.message}`);

  const boards: InspoBoard[] = (
    (boardsRes.data ?? []) as unknown as { id: string; name: string; hq_inspo_board_posts: { count: number }[] }[]
  ).map((b) => ({ id: b.id, name: b.name, postCount: b.hq_inspo_board_posts[0]?.count ?? 0 }));

  // Favorites / board tabs narrow to an explicit id list first (both lists
  // are small — hand-curated), then the normal filters apply on top.
  let restrictIds: string[] | null = null;
  if (filters.tab === "favorites") {
    const { data, error } = await supabase.from("hq_inspo_favorites").select("post_id, user_id");
    if (error) throw new Error(`Failed to load favorites: ${error.message}`);
    const counts = new Map<string, number>();
    const mine = new Set<string>();
    for (const f of (data ?? []) as { post_id: string; user_id: string }[]) {
      counts.set(f.post_id, (counts.get(f.post_id) ?? 0) + 1);
      if (f.user_id === currentUserId) mine.add(f.post_id);
    }
    restrictIds =
      filters.fav === "mine"
        ? Array.from(mine)
        : Array.from(counts.entries())
            .filter(([, n]) => filters.fav !== "shared" || n >= 2)
            .map(([id]) => id);
  } else if (filters.tab.startsWith("board:")) {
    const { data, error } = await supabase
      .from("hq_inspo_board_posts")
      .select("post_id")
      .eq("board_id", filters.tab.slice(6));
    if (error) throw new Error(`Failed to load board: ${error.message}`);
    restrictIds = ((data ?? []) as { post_id: string }[]).map((r) => r.post_id);
  }

  const libraryEmpty = (anyPostRes.data ?? []).length === 0;
  if (restrictIds !== null && restrictIds.length === 0) {
    return { posts: [], total: 0, boards, people: {}, libraryEmpty };
  }

  let query = supabase.from("hq_inspo_posts").select(POST_SELECT, { count: "exact" });

  if (restrictIds !== null) query = query.in("id", restrictIds);
  // Hidden posts only appear on the Hidden tab; curated tabs show them too
  // (if you starred it, you want to see it).
  if (filters.tab === "hidden") query = query.eq("hidden", true);
  else if (restrictIds === null) query = query.eq("hidden", false);
  if (filters.tab === "videos") query = query.in("format", VIDEO_FORMATS);
  if (filters.tab === "slideshows") query = query.in("format", SLIDE_FORMATS);

  query = query.in("topic", filters.topics).in("platform", filters.platforms);
  if (!filters.big) {
    query = query.or(`creator_followers.is.null,creator_followers.lte.${INSPO_BIG_ACCOUNT_FOLLOWERS}`);
  }
  const sinceDays = INSPO_SINCE.find((s) => s.key === filters.since)?.days;
  if (sinceDays) {
    query = query.gte("posted_at", new Date(Date.now() - sinceDays * 86_400_000).toISOString());
  }
  if (filters.tag) query = query.contains("hashtags", [filters.tag]);
  const q = sanitizeSearch(filters.q);
  if (q) query = query.or(`caption.ilike.*${q}*,creator_username.ilike.*${q}*,creator_name.ilike.*${q}*`);

  const from = (filters.page - 1) * INSPO_PAGE_SIZE;
  const { data, error, count } = await query
    .order(SORT_COLUMN[filters.sort], { ascending: false, nullsFirst: false })
    .order("views", { ascending: false, nullsFirst: false })
    .order("id")
    .range(from, from + INSPO_PAGE_SIZE - 1);

  if (error) throw new Error(`Failed to load posts: ${error.message}`);

  const posts: InspoPost[] = ((data ?? []) as unknown as PostRow[]).map((r) => ({
    id: r.id,
    platform: r.platform,
    format: r.format,
    url: r.url,
    creatorUsername: r.creator_username,
    creatorName: r.creator_name,
    creatorFollowers: r.creator_followers,
    creatorVerified: r.creator_verified,
    caption: r.caption,
    hashtags: r.hashtags ?? [],
    views: r.views,
    likes: r.likes,
    comments: r.comments,
    shares: r.shares,
    saves: r.saves,
    durationSeconds: r.duration_seconds === null ? null : Number(r.duration_seconds),
    slideCount: r.slide_count,
    sound: r.sound,
    postedAt: r.posted_at,
    topic: r.topic,
    sourceQuery: r.source_query,
    hidden: r.hidden,
    outlierScore: r.outlier_score === null ? null : Number(r.outlier_score),
    engagementRate: r.engagement_rate === null ? null : Number(r.engagement_rate),
    saveRate: r.save_rate === null ? null : Number(r.save_rate),
    shareRate: r.share_rate === null ? null : Number(r.share_rate),
    favoritedBy: r.hq_inspo_favorites.map((f) => f.user_id),
    boardIds: r.hq_inspo_board_posts.map((b) => b.board_id),
    notes: r.hq_inspo_notes
      .map((n) => ({ id: n.id, authorId: n.author_id, body: n.body, createdAt: n.created_at }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  }));

  const ids = new Set<string>([currentUserId]);
  for (const p of posts) {
    p.favoritedBy.forEach((id) => ids.add(id));
    p.notes.forEach((n) => ids.add(n.authorId));
  }

  return { posts, total: count ?? 0, boards, people: await resolvePeople(Array.from(ids)), libraryEmpty };
}
