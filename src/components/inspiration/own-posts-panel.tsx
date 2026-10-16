import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Card, SectionLabel } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { getOwnPosts, MIN_POSTS, type OwnGroupRow, type OwnSort, type Verdict } from "@/lib/data/own-posts";
import { OwnThemeSelect } from "./own-theme-select";

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const count = (n: number | null) => (n === null ? "—" : compact.format(n));
const pct = (r: number | null) => (r === null ? "—" : `${(r * 100).toFixed(2)}%`);
const times = (r: number | null) => (r === null ? "—" : `${r.toFixed(1)}×`);
const safeUrl = (url: string) => (/^https:\/\/(www\.)?(tiktok\.com|instagram\.com)\//.test(url) ? url : null);

const VERDICT: Record<Verdict, { label: string; tone: "accent" | "neutral" | "warn" }> = {
  working: { label: "Working", tone: "accent" },
  average: { label: "Average", tone: "neutral" },
  "not-working": { label: "Not working", tone: "warn" },
  "too-few": { label: `Under ${MIN_POSTS} posts`, tone: "neutral" },
};

const SORTS: { key: OwnSort; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "index", label: "Best vs our usual" },
  { key: "views", label: "Most views" },
  { key: "saves", label: "Save rate" },
];

function GroupTable({ title, rows, showLibrary }: { title: string; rows: OwnGroupRow[]; showLibrary?: boolean }) {
  return (
    <Card>
      <SectionLabel>{title}</SectionLabel>
      {rows.length === 0 ? (
        <p className="text-xs text-faint">No posts yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-[13px]">
            <thead>
              <tr className="border-b border-edge text-left text-[11px] uppercase tracking-wider text-faint">
                <th className="pb-2 font-normal" />
                <th className="pb-2 text-right font-normal">Posts</th>
                <th className="pb-2 text-right font-normal" title="Median views ÷ our usual views on that platform">Views</th>
                <th className="pb-2 text-right font-normal">Save rate</th>
                {showLibrary && <th className="pb-2 text-right font-normal" title="Library median save rate for this theme">Library</th>}
                <th className="pb-2 text-right font-normal" />
              </tr>
            </thead>
            <tbody>
              {rows.map((g) => (
                <tr key={g.key} className={cn("border-b border-edge last:border-b-0", g.verdict === "too-few" && "text-muted")}>
                  <td className="py-2 pr-2">{g.label}</td>
                  <td className="tnum py-2 text-right text-muted">{g.posts}</td>
                  <td className={cn("tnum py-2 text-right", g.verdict === "working" && "font-semibold text-accent")}>{times(g.medianIndex)}</td>
                  <td className="tnum py-2 text-right">{pct(g.medianSaveRate)}</td>
                  {showLibrary && <td className="tnum py-2 text-right text-muted">{pct(g.libraryMedianSaveRate)}</td>}
                  <td className="py-2 pl-2 text-right">
                    <Badge tone={VERDICT[g.verdict].tone}>{VERDICT[g.verdict].label}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export async function OwnPostsPanel({ sort }: { sort: OwnSort }) {
  const data = await getOwnPosts(sort);

  if (data.posts.length === 0) {
    return (
      <Card>
        <EmptyState
          label="No posts tracked yet"
          hint="The daily sync (1pm UTC) pulls our Instagram posts, and our TikTok posts the day after it first runs."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["TikTok posts", String(data.counts.tiktok)],
          ["Instagram posts", String(data.counts.instagram)],
          ["Usual views (median)", `${count(data.medianViews.tiktok)} TT · ${count(data.medianViews.instagram)} IG`],
          ["Usual save rate", pct(data.medianSaveRate)],
        ].map(([label, value]) => (
          <Card key={label}>
            <p className="mb-1.5 text-[11px] uppercase tracking-wider text-muted">{label}</p>
            <p className="tnum text-xl font-semibold">{value}</p>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted">
        “Views” in these tables is a post&apos;s views ÷ our usual on that platform, so 2.0× means twice our normal reach.
        Working = 1.25× or better, not working = 0.8× or worse; groups under {MIN_POSTS} posts don&apos;t get a verdict.
        {data.lastSynced && <> Last synced {formatRelativeTime(data.lastSynced)}.</>}
      </p>

      <GroupTable title="By theme" rows={data.byTheme} showLibrary />
      <div className="grid gap-4 lg:grid-cols-2">
        <GroupTable title="By how the caption opens" rows={data.byHook} />
        <GroupTable title="By format" rows={data.byFormat} />
      </div>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <SectionLabel>Every post</SectionLabel>
          <div className="-mt-3 flex flex-wrap gap-1">
            {SORTS.map((s) => (
              <Link
                key={s.key}
                href={s.key === "newest" ? "/inspiration/ours" : `/inspiration/ours?sort=${s.key}`}
                scroll={false}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs transition-colors",
                  sort === s.key ? "bg-accent/10 text-accent" : "text-faint hover:text-muted"
                )}
              >
                {s.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-[13px]">
            <thead>
              <tr className="border-b border-edge text-left text-[11px] uppercase tracking-wider text-faint">
                <th className="pb-2 font-normal">Post</th>
                <th className="pb-2 font-normal">Theme</th>
                <th className="pb-2 text-right font-normal">Views</th>
                <th className="pb-2 text-right font-normal" title="Views at 7 days old, once a snapshot exists">@ 7 days</th>
                <th className="pb-2 text-right font-normal">vs usual</th>
                <th className="pb-2 text-right font-normal">Likes</th>
                <th className="pb-2 text-right font-normal">Shares</th>
                <th className="pb-2 text-right font-normal">Saves</th>
                <th className="pb-2 text-right font-normal">Save rate</th>
              </tr>
            </thead>
            <tbody>
              {data.posts.map((p) => {
                const href = safeUrl(p.url);
                return (
                  <tr key={p.id} className="border-b border-edge align-top last:border-b-0">
                    <td className="max-w-[22rem] py-2.5 pr-3">
                      <div className="mb-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-faint">
                        <Badge tone={p.platform === "tiktok" ? "neutral" : "accent"}>{p.platform === "tiktok" ? "TikTok" : "Instagram"}</Badge>
                        <span>{p.format}</span>
                        <span>{formatRelativeTime(p.postedAt)}</span>
                        {href && (
                          <a href={href} target="_blank" rel="noopener noreferrer" aria-label="Open post" className="hover:text-accent">
                            <ExternalLink className="h-3 w-3" strokeWidth={1.75} />
                          </a>
                        )}
                      </div>
                      <p className="line-clamp-2 break-words">{p.caption ?? "—"}</p>
                    </td>
                    <td className="py-2.5 pr-2">
                      <OwnThemeSelect postId={p.id} theme={p.theme} setByFounder={p.themeSetByFounder} />
                    </td>
                    <td className="tnum py-2.5 text-right">{count(p.views)}</td>
                    <td className="tnum py-2.5 text-right text-muted">{count(p.views7d)}</td>
                    <td
                      className={cn(
                        "tnum py-2.5 text-right",
                        p.viewsIndex !== null && p.viewsIndex >= 1.25 && "font-semibold text-accent",
                        p.viewsIndex !== null && p.viewsIndex <= 0.8 && "text-muted"
                      )}
                    >
                      {times(p.viewsIndex)}
                    </td>
                    <td className="tnum py-2.5 text-right text-muted">{count(p.likes)}</td>
                    <td className="tnum py-2.5 text-right text-muted">{count(p.shares)}</td>
                    <td className="tnum py-2.5 text-right text-muted">{count(p.saves)}</td>
                    <td className="tnum py-2.5 text-right">{pct(p.saveRate)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function OwnPostsPanelSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
