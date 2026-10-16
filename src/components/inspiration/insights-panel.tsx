import Link from "next/link";
import { ChevronRight, ExternalLink, Images, Music2, Play } from "lucide-react";
import { Card, SectionLabel } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { INSPO_BIG_ACCOUNT_FOLLOWERS, INSPO_PROVEN_VIEWS } from "@/lib/constants";
import {
  getInsights,
  type BucketRow,
  type InsightsFilters,
  type ThemeRow,
} from "@/lib/data/inspiration-insights";
import { cn } from "@/lib/cn";
import { BriefButton } from "./brief-button";

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const pct = (r: number | null) => (r === null ? "—" : `${(r * 100).toFixed(2)}%`);

// Scraped URLs are untrusted — only ever link to the two platforms.
const safeUrl = (url: string) => (/^https:\/\/(www\.)?(tiktok\.com|instagram\.com)\//.test(url) ? url : null);

function insightsHref(f: InsightsFilters, patch: Partial<InsightsFilters>) {
  const next = { ...f, ...patch };
  const p = new URLSearchParams();
  if (next.group !== "all") p.set("group", next.group);
  if (next.slidesOnly) p.set("slides", "1");
  if (next.sort === "saves") p.set("sort", "saves");
  const qs = p.toString();
  return qs ? `/inspiration/insights?${qs}` : "/inspiration/insights";
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      className={cn(
        "rounded-md px-2.5 py-1 text-xs transition-colors",
        active ? "bg-accent/10 text-accent" : "text-muted hover:text-ink"
      )}
    >
      {children}
    </Link>
  );
}

// Save rate vs the whole analyzed set, as a bar so strong themes pop.
function RateBar({ rate, baseline }: { rate: number | null; baseline: number | null }) {
  if (rate === null || !baseline) return <span className="tnum text-muted">{pct(rate)}</span>;
  const ratio = rate / baseline;
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-surface-2 sm:block" aria-hidden="true">
        <div
          className={cn("h-full rounded-full", ratio >= 1 ? "bg-accent" : "bg-faint")}
          style={{ width: `${Math.min(100, ratio * 50)}%` }}
        />
      </div>
      <span className={cn("tnum", ratio >= 1.25 ? "font-semibold text-accent" : "text-ink")}>{pct(rate)}</span>
    </div>
  );
}

function ThemeTable({ themes, baseline, filters }: { themes: ThemeRow[]; baseline: number | null; filters: InsightsFilters }) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_4rem_5.5rem_7.5rem_5.5rem_8rem] gap-2 border-b border-edge pb-2 text-[11px] uppercase tracking-wider text-faint">
          <span className="pl-6">Theme</span>
          <span className="text-right" title={`Different creators with a ${compact.format(INSPO_PROVEN_VIEWS)}+ view post`}>Proven by</span>
          <span className="text-right">Posts</span>
          <span className="text-right">Med. views</span>
          <span className="text-right">Save rate</span>
          <span className="text-right">Share rate</span>
          <span className="text-right">Slides vs video</span>
        </div>
        {themes.map((t) => (
          <details key={t.theme} className="group border-b border-edge last:border-b-0">
            <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_5.5rem_4rem_5.5rem_7.5rem_5.5rem_8rem] items-center gap-2 py-2.5 text-[13px] [&::-webkit-details-marker]:hidden">
              <span className="flex min-w-0 items-center gap-2">
                <ChevronRight className="h-4 w-4 shrink-0 text-faint transition-transform group-open:rotate-90" strokeWidth={1.75} />
                <span className="truncate font-medium">{t.label}</span>
                <span className="shrink-0 rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted">
                  {t.group === "recruiting" ? "Recruiting" : "Golf"}
                </span>
              </span>
              <span className="tnum text-right">
                <span className="font-semibold">{t.provenCreators}</span>
                <span className="text-faint"> / {t.creators}</span>
              </span>
              <span className="tnum text-right text-muted">{t.posts}</span>
              <span className="tnum text-right text-muted">{compact.format(t.medianViews)}</span>
              <RateBar rate={t.medianSaveRate} baseline={baseline} />
              <span className="tnum text-right text-muted">{pct(t.medianShareRate)}</span>
              <span className="tnum text-right text-[12px] text-muted">
                {pct(t.slideSaveRate)} <span className="text-faint">vs</span> {pct(t.videoSaveRate)}
              </span>
            </summary>
            <div className="space-y-2 pb-3 pl-6">
              <p className="text-[11px] uppercase tracking-wider text-faint">Most-saved examples</p>
              <ul className="space-y-1.5">
                {t.examples.map((e) => {
                  const href = safeUrl(e.url);
                  return (
                    <li key={e.id} className="flex items-start gap-2 text-xs">
                      {e.format === "video" || e.format === "reel" ? (
                        <Play className="mt-0.5 h-3.5 w-3.5 shrink-0 text-faint" strokeWidth={2} />
                      ) : (
                        <Images className="mt-0.5 h-3.5 w-3.5 shrink-0 text-faint" strokeWidth={2} />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="font-medium">@{e.creator ?? "unknown"}</span>
                        <span className="tnum text-faint">
                          {" "}
                          · {compact.format(e.views)} views · {e.saves === null ? "—" : compact.format(e.saves)} saves
                          {e.slideCount ? ` · ${e.slideCount} slides` : ""}
                        </span>
                        <span className="mt-0.5 line-clamp-1 block text-muted">{e.caption}</span>
                      </span>
                      {href && (
                        <a href={href} target="_blank" rel="noopener noreferrer" aria-label="Open post" className="shrink-0 text-faint hover:text-accent">
                          <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <BriefButton kind="theme" id={t.theme} label="Carousel brief for this theme" />
                <Link
                  href={`/inspiration?theme=${t.theme}&sort=saves${filters.slidesOnly ? "&tab=slideshows" : ""}`}
                  className="text-xs text-accent hover:underline"
                >
                  Browse all {t.posts} in the library →
                </Link>
              </div>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

function BucketTable({ rows, baseline, firstCol }: { rows: BucketRow[]; baseline: number | null; firstCol: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[440px] text-[13px]">
        <thead>
          <tr className="border-b border-edge text-left text-[11px] uppercase tracking-wider text-faint">
            <th className="pb-2 font-normal">{firstCol}</th>
            <th className="pb-2 text-right font-normal">Posts</th>
            <th className="pb-2 text-right font-normal">Creators</th>
            <th className="pb-2 text-right font-normal">Med. views</th>
            <th className="pb-2 text-right font-normal">Save rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.key} className={cn("border-b border-edge last:border-b-0", b.posts < 10 && "text-muted")}>
              <td className="py-2">{b.label}</td>
              <td className="tnum py-2 text-right text-muted">{b.posts}</td>
              <td className="tnum py-2 text-right text-muted">{b.creators}</td>
              <td className="tnum py-2 text-right text-muted">{compact.format(b.medianViews)}</td>
              <td className="py-2">{b.posts < 10 ? <span className="tnum block text-right text-faint">too few</span> : <RateBar rate={b.medianSaveRate} baseline={baseline} />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export async function InsightsPanel({ filters }: { filters: InsightsFilters }) {
  const data = await getInsights(filters);

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1">
            <Chip href={insightsHref(filters, { group: "all" })} active={filters.group === "all"}>All themes</Chip>
            <Chip href={insightsHref(filters, { group: "golf" })} active={filters.group === "golf"}>Golf skills</Chip>
            <Chip href={insightsHref(filters, { group: "recruiting" })} active={filters.group === "recruiting"}>Recruiting & college</Chip>
            <span className="mx-1 h-4 w-px bg-edge" aria-hidden="true" />
            <Chip href={insightsHref(filters, { slidesOnly: !filters.slidesOnly })} active={filters.slidesOnly}>
              {filters.slidesOnly ? "✓ " : ""}Slideshows & carousels only
            </Chip>
          </div>
          <p className="tnum text-xs text-muted">
            {data.analyzed.toLocaleString()} posts analyzed · baseline save rate {pct(data.baselineSaveRate)}
          </p>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-faint">
          Left out so the patterns are copyable: {data.excludedPersonal} personal posts (POV, day-in-my-life, “I committed”),{" "}
          {data.excludedBig} from accounts over {compact.format(INSPO_BIG_ACCOUNT_FOLLOWERS)} followers, and {data.excludedNoViews} with
          no view count (Instagram carousels). All figures are medians. Save rate = saves ÷ views.
        </p>
      </Card>

      {data.analyzed === 0 ? (
        <Card>
          <EmptyState label="Nothing to analyze with these filters" hint="Try All themes, or turn off Slideshows only." />
        </Card>
      ) : (
        <>
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SectionLabel>Themes that work for many creators</SectionLabel>
              <div className="-mt-3 flex items-center gap-1 text-xs text-faint">
                Sort by
                <Chip href={insightsHref(filters, { sort: "proven" })} active={filters.sort === "proven"}>Reach</Chip>
                <Chip href={insightsHref(filters, { sort: "saves" })} active={filters.sort === "saves"}>Save rate</Chip>
              </div>
            </div>
            <p className="mb-3 text-xs text-muted">
              {filters.sort === "proven" ? (
                <>
                  Sorted by how many <em>different</em> small and mid-size creators got a {compact.format(INSPO_PROVEN_VIEWS)}+ view
                  post from the theme: a theme many creators hit is a format you can run, one creator hitting it is luck.
                </>
              ) : (
                <>
                  Sorted by median save rate: what people keep coming back to, the strongest signal for useful content.
                  Themes with under 10 posts sit at the bottom.
                </>
              )}{" "}
              Click a row for examples.
            </p>
            <ThemeTable themes={data.themes} baseline={data.baselineSaveRate} filters={filters} />
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <SectionLabel>How the caption opens</SectionLabel>
              <BucketTable rows={data.hooks} baseline={data.baselineSaveRate} firstCol="Opening" />
            </Card>
            <Card>
              <SectionLabel>Slide count (slideshows & carousels)</SectionLabel>
              <BucketTable rows={data.slideCounts} baseline={data.baselineSaveRate} firstCol="Slides" />
            </Card>
            <Card>
              <SectionLabel>Caption length</SectionLabel>
              <BucketTable rows={data.captionLengths} baseline={data.baselineSaveRate} firstCol="Length" />
            </Card>
            <Card>
              <SectionLabel>Sounds on the best-saving slideshows</SectionLabel>
              {data.sounds.length === 0 ? (
                <EmptyState icon={Music2} label="Not enough sound data" hint="Needs the same sound on top slideshows from 2+ creators." />
              ) : (
                <ul className="space-y-1.5">
                  {data.sounds.map((s) => (
                    <li key={s.sound} className="flex items-center justify-between gap-3 text-[13px]">
                      <span className="flex min-w-0 items-center gap-2">
                        <Music2 className="h-3.5 w-3.5 shrink-0 text-faint" strokeWidth={1.75} />
                        <span className="truncate">{s.sound}</span>
                      </span>
                      <span className="tnum shrink-0 text-xs text-muted">
                        {s.creators} creators · {s.posts} posts
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-[11px] text-faint">Top quarter of slideshows by save rate; “original sound” left out.</p>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

export function InsightsPanelSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-96 w-full" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
