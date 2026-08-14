"use client";

import { useMemo, useState } from "react";
import { Instagram, Heart, MessageCircle, Eye, Bookmark } from "lucide-react";
import { Card, SectionLabel } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";
import { formatRelativeTime } from "@/lib/format";
import { InstagramFollowersChart } from "@/components/charts/instagram-followers-chart";
import type { InstagramMedia, AccountInsights, DailyMetricPoint } from "@/lib/instagram";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "posts", label: "Posts" },
] as const;

const SORTS = [
  { key: "recent", label: "Most recent" },
  { key: "likes", label: "Most liked" },
  { key: "comments", label: "Most commented" },
  { key: "reach", label: "Most reach" },
  { key: "views", label: "Most viewed" },
] as const;

type SortKey = (typeof SORTS)[number]["key"];

function sortValue(media: InstagramMedia, key: SortKey): number {
  switch (key) {
    case "likes":
      return media.likeCount;
    case "comments":
      return media.commentsCount;
    case "reach":
      return media.reach ?? -1;
    case "views":
      return media.views ?? -1;
    case "recent":
    default:
      return new Date(media.timestamp).getTime();
  }
}

function StatTile({ label, value }: { label: string; value: number | null }) {
  return (
    <Card>
      <p className="mb-1.5 text-[11px] uppercase tracking-wider text-muted">{label}</p>
      <p className="tnum text-2xl font-semibold">{value != null ? value.toLocaleString() : "—"}</p>
    </Card>
  );
}

export function SocialTabs({
  followerCount,
  mediaCount,
  insights,
  followerHistory,
  reachHistory,
  recentMedia,
}: {
  followerCount: number | null;
  mediaCount: number | null;
  insights: AccountInsights;
  followerHistory: DailyMetricPoint[];
  reachHistory: DailyMetricPoint[];
  recentMedia: InstagramMedia[];
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("overview");
  const [sort, setSort] = useState<SortKey>("recent");

  const sortedMedia = useMemo(
    () => [...recentMedia].sort((a, b) => sortValue(b, sort) - sortValue(a, sort)),
    [recentMedia, sort]
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-edge">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "border-b-2 px-3 py-2 text-[13px] font-medium transition-colors",
              tab === t.key
                ? "border-accent text-ink"
                : "border-transparent text-muted hover:text-ink"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="stagger space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Followers" value={followerCount} />
            <StatTile label="Reach (30d)" value={insights.reach} />
            <StatTile label="Profile views (30d)" value={insights.profileViews} />
            <StatTile label="Accounts engaged (30d)" value={insights.accountsEngaged} />
          </div>
          <Card>
            <SectionLabel>Growth</SectionLabel>
            <InstagramFollowersChart followerHistory={followerHistory} reachHistory={reachHistory} />
          </Card>
          <Card className="flex items-center justify-between">
            <p className="text-xs text-muted">Total posts</p>
            <p className="tnum text-sm font-medium">{mediaCount?.toLocaleString() ?? "—"}</p>
          </Card>
        </div>
      ) : (
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <SectionLabel>Recent posts</SectionLabel>
            <div className="flex flex-wrap gap-1">
              {SORTS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSort(s.key)}
                  className={cn(
                    "whitespace-nowrap rounded-md px-2.5 py-1 text-xs transition-colors",
                    sort === s.key ? "bg-accent/10 text-accent" : "text-faint hover:text-muted"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {sortedMedia.length === 0 ? (
            <EmptyState icon={Instagram} label="No posts yet" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sortedMedia.map((media, i) => (
                <a
                  key={media.id}
                  href={media.permalink}
                  target="_blank"
                  rel="noreferrer"
                  className="group relative overflow-hidden rounded-lg border border-edge transition-colors hover:border-edge-strong"
                >
                  {sort !== "recent" && i === 0 && (
                    <span className="absolute left-2 top-2 z-10 rounded-full bg-ink/80 px-2 py-0.5 text-[10px] font-medium text-surface">
                      Top {SORTS.find((s) => s.key === sort)?.label.replace("Most ", "")}
                    </span>
                  )}
                  <div className="aspect-square w-full overflow-hidden bg-surface-2">
                    {media.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={media.imageUrl}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Instagram className="h-6 w-6 text-faint" strokeWidth={1.5} />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="line-clamp-2 text-xs text-ink">{media.caption ?? "No caption"}</p>
                    <p className="mt-1 text-[11px] text-faint">{formatRelativeTime(media.timestamp)}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                      <span className="flex items-center gap-1">
                        <Heart className="h-3.5 w-3.5" strokeWidth={1.75} />
                        <span className="tnum">{media.likeCount.toLocaleString()}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.75} />
                        <span className="tnum">{media.commentsCount.toLocaleString()}</span>
                      </span>
                      {media.reach != null && (
                        <span className="flex items-center gap-1">
                          <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />
                          <span className="tnum">{media.reach.toLocaleString()}</span>
                        </span>
                      )}
                      {media.views != null && (
                        <span className="flex items-center gap-1 text-accent">
                          <span className="tnum">{media.views.toLocaleString()} views</span>
                        </span>
                      )}
                      {media.saved != null && (
                        <span className="flex items-center gap-1">
                          <Bookmark className="h-3.5 w-3.5" strokeWidth={1.75} />
                          <span className="tnum">{media.saved.toLocaleString()}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
