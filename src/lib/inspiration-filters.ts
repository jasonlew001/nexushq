// URL <-> filter state for /inspiration. Client-safe (no server imports): the
// server page parses searchParams with this, the filter bar serializes with it,
// so both sides always agree on what a URL means.
import {
  INSPO_SORTS,
  INSPO_TOPICS,
  type InspoSort,
  type InspoTopic,
} from "@/lib/constants";

export const INSPO_TABS = [
  { key: "all", label: "All" },
  { key: "videos", label: "Videos & Reels" },
  { key: "slideshows", label: "Slideshows & Carousels" },
  { key: "advice", label: "Tips & Advice" },
  { key: "favorites", label: "Favorites" },
  { key: "hidden", label: "Hidden" },
] as const;

type BaseTab = (typeof INSPO_TABS)[number]["key"];
export type InspoTab = BaseTab | `board:${string}`;

export const INSPO_PLATFORMS = [
  { key: "tiktok", label: "TikTok" },
  { key: "instagram", label: "Instagram" },
] as const;
export type InspoPlatform = (typeof INSPO_PLATFORMS)[number]["key"];

export const INSPO_SINCE = [
  { key: "all", label: "Any time", days: null },
  { key: "12m", label: "12 months", days: 365 },
  { key: "6m", label: "6 months", days: 182 },
  { key: "90d", label: "90 days", days: 90 },
  { key: "30d", label: "30 days", days: 30 },
] as const;
export type InspoSince = (typeof INSPO_SINCE)[number]["key"];

export const INSPO_FAV_SCOPES = [
  { key: "any", label: "Anyone" },
  { key: "mine", label: "Mine" },
  { key: "shared", label: "Starred by 2+" },
] as const;
export type InspoFavScope = (typeof INSPO_FAV_SCOPES)[number]["key"];

export interface InspoFilters {
  tab: InspoTab;
  sort: InspoSort;
  q: string;
  tag: string;
  topics: InspoTopic[];
  platforms: InspoPlatform[];
  big: boolean;
  since: InspoSince;
  fav: InspoFavScope;
  page: number;
}

const ALL_TOPICS = INSPO_TOPICS.map((t) => t.key) as InspoTopic[];
const ALL_PLATFORMS = INSPO_PLATFORMS.map((p) => p.key) as InspoPlatform[];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const DEFAULT_INSPO_FILTERS: InspoFilters = {
  tab: "all",
  sort: "outlier",
  q: "",
  tag: "",
  topics: ALL_TOPICS,
  platforms: ALL_PLATFORMS,
  big: false,
  since: "all",
  fav: "any",
  page: 1,
};

type Params = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function pickList<T extends string>(raw: string, allowed: readonly T[]): T[] {
  if (!raw) return [...allowed];
  const picked = raw.split(",").filter((v): v is T => (allowed as readonly string[]).includes(v));
  return picked.length ? picked : [...allowed];
}

function pickOne<T extends string>(raw: string, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

export function parseInspoFilters(params: Params): InspoFilters {
  const rawTab = first(params.tab);
  const tab: InspoTab =
    rawTab.startsWith("board:") && UUID_RE.test(rawTab.slice(6))
      ? (rawTab as InspoTab)
      : pickOne(rawTab, INSPO_TABS.map((t) => t.key), "all");

  return {
    tab,
    sort: pickOne(first(params.sort), INSPO_SORTS.map((s) => s.key), "outlier"),
    q: first(params.q).slice(0, 100),
    tag: first(params.tag).replace(/^#/, "").toLowerCase().slice(0, 100),
    topics: pickList(first(params.topics), ALL_TOPICS),
    platforms: pickList(first(params.platforms), ALL_PLATFORMS),
    big: first(params.big) === "1",
    since: pickOne(first(params.since), INSPO_SINCE.map((s) => s.key), "all"),
    fav: pickOne(first(params.fav), INSPO_FAV_SCOPES.map((s) => s.key), "any"),
    page: Math.max(1, Math.min(1000, parseInt(first(params.page), 10) || 1)),
  };
}

// Only non-default values go in the URL, so links stay short and shareable.
export function inspoHref(filters: InspoFilters): string {
  const p = new URLSearchParams();
  const d = DEFAULT_INSPO_FILTERS;
  if (filters.tab !== d.tab) p.set("tab", filters.tab);
  if (filters.sort !== d.sort) p.set("sort", filters.sort);
  if (filters.q) p.set("q", filters.q);
  if (filters.tag) p.set("tag", filters.tag);
  if (filters.topics.length !== ALL_TOPICS.length) p.set("topics", filters.topics.join(","));
  if (filters.platforms.length !== ALL_PLATFORMS.length) p.set("platforms", filters.platforms.join(","));
  if (filters.big) p.set("big", "1");
  if (filters.since !== d.since) p.set("since", filters.since);
  if (filters.fav !== d.fav) p.set("fav", filters.fav);
  if (filters.page > 1) p.set("page", String(filters.page));
  const qs = p.toString();
  return qs ? `/inspiration?${qs}` : "/inspiration";
}
