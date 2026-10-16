"use client";

import { useState, useTransition } from "react";
import {
  ChevronRight,
  EyeOff,
  Eye,
  ExternalLink,
  Images,
  MessageSquare,
  Music2,
  Play,
  Star,
  Trash2,
  BadgeCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { addNote, deleteNote, setFavorite, setHidden, setOnBoard } from "@/actions/inspiration";
import { INSPO_TOPICS } from "@/lib/constants";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { InspoBoard, InspoPost } from "@/lib/data/inspiration";
import { BriefButton } from "./brief-button";

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export function fmtCount(n: number | null): string {
  return n === null ? "—" : compact.format(n);
}

function fmtRate(r: number | null): string {
  return r === null ? "—" : `${(r * 100).toFixed(r < 0.01 ? 2 : 1)}%`;
}

export function fmtOutlier(n: number | null): string {
  if (n === null) return "—";
  return n >= 10 ? `${Math.round(n)}×` : `${n.toFixed(1)}×`;
}

const FORMAT_LABEL: Record<InspoPost["format"], string> = {
  video: "Video",
  reel: "Reel",
  slideshow: "Slideshow",
  carousel: "Carousel",
  image: "Image",
};

const TOPIC_LABEL = Object.fromEntries(INSPO_TOPICS.map((t) => [t.key, t.label]));

// Scraped URLs are untrusted — only ever link to the two platforms.
function safePostUrl(url: string): string | null {
  return /^https:\/\/(www\.)?(tiktok\.com|instagram\.com)\//.test(url) ? url : null;
}

// "3d ago" is useful for fresh posts; "959d ago" isn't — switch to a date.
function fmtAge(iso: string): string {
  const days = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  if (days < 30) return formatRelativeTime(iso);
  return new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function initials(name: string): string {
  return name.slice(0, 1).toUpperCase();
}

// Grid shared with the column header in inspiration-library.tsx.
export const ROW_GRID =
  "lg:grid lg:grid-cols-[minmax(0,1fr)_repeat(6,4.25rem)_5.5rem] lg:items-center lg:gap-2";

export function PostRow({
  post,
  boards,
  people,
  currentUserId,
  onTag,
}: {
  post: InspoPost;
  boards: InspoBoard[];
  people: Record<string, string>;
  currentUserId: string;
  onTag: (tag: string) => void;
}) {
  const [open, setOpen] = useState(false);
  // Optimistic overlays — painted instantly, server re-render reconciles.
  const [starred, setStarred] = useState<boolean | null>(null);
  const [onBoards, setOnBoards] = useState<Set<string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isMine = starred ?? post.favoritedBy.includes(currentUserId);
  const othersStarred = post.favoritedBy.filter((id) => id !== currentUserId);
  const boardSet = onBoards ?? new Set(post.boardIds);
  const href = safePostUrl(post.url);
  const isVideo = post.format === "video" || post.format === "reel";

  function run(action: () => Promise<void>, revert: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (err) {
        revert();
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  function toggleStar() {
    const next = !isMine;
    setStarred(next);
    run(() => setFavorite(post.id, next), () => setStarred(null));
  }

  function toggleBoard(boardId: string) {
    const next = new Set(boardSet);
    const on = !next.has(boardId);
    if (on) next.add(boardId);
    else next.delete(boardId);
    setOnBoards(next);
    run(() => setOnBoard(post.id, boardId, on), () => setOnBoards(null));
  }

  const stats: [string, string][] = [
    ["Views", fmtCount(post.views)],
    ["Likes", fmtCount(post.likes)],
    ["Comments", fmtCount(post.comments)],
    ["Shares", fmtCount(post.shares)],
    ["Saves", fmtCount(post.saves)],
    ["Outlier", fmtOutlier(post.outlierScore)],
  ];

  return (
    <li className={cn("border-b border-edge last:border-b-0", post.hidden && "opacity-60")}>
      <div className={cn("gap-3 py-3", ROW_GRID)}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-w-0 items-start gap-2 text-left"
        >
          <ChevronRight
            className={cn("mt-0.5 h-4 w-4 shrink-0 text-faint transition-transform", open && "rotate-90")}
            strokeWidth={1.75}
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <Badge tone={post.platform === "tiktok" ? "neutral" : "accent"}>
                {post.platform === "tiktok" ? "TikTok" : "Instagram"}
              </Badge>
              <span className="flex items-center gap-1 text-muted">
                {isVideo ? <Play className="h-3 w-3" strokeWidth={2} /> : <Images className="h-3 w-3" strokeWidth={2} />}
                {FORMAT_LABEL[post.format]}
                {post.slideCount ? ` · ${post.slideCount} slide${post.slideCount === 1 ? "" : "s"}` : ""}
              </span>
              <span className="flex min-w-0 items-center gap-1 font-medium text-ink">
                <span className="truncate">@{post.creatorUsername ?? "unknown"}</span>
                {post.creatorVerified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={2} />}
              </span>
              <span className="tnum text-faint">{fmtCount(post.creatorFollowers)} followers</span>
              {post.postedAt && <span className="text-faint">{fmtAge(post.postedAt)}</span>}
            </div>
            {post.caption && (
              <p className="mt-1 line-clamp-2 break-words text-[13px] leading-snug text-ink/90">{post.caption}</p>
            )}
          </div>
        </button>

        {/* Stats: a wrapped strip on mobile, aligned columns on desktop. */}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 pl-6 lg:contents">
          {stats.map(([label, value]) => (
            <div key={label} className="lg:text-right">
              <span className="mr-1 text-[10px] uppercase tracking-wider text-faint lg:hidden">{label}</span>
              <span className={cn("tnum text-[13px]", label === "Outlier" ? "font-semibold text-accent" : "text-ink")}>
                {value}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-2 flex items-center justify-end gap-2 pl-6 lg:mt-0 lg:pl-0">
          {othersStarred.length > 0 && (
            <span className="flex -space-x-1" title={`Starred by ${othersStarred.map((id) => people[id] ?? "founder").join(", ")}`}>
              {othersStarred.map((id) => (
                <span
                  key={id}
                  className="flex h-5 w-5 items-center justify-center rounded-full border border-surface bg-gold/20 text-[10px] font-semibold text-gold"
                >
                  {initials(people[id] ?? "?")}
                </span>
              ))}
            </span>
          )}
          {post.notes.length > 0 && (
            <span className="tnum flex items-center gap-0.5 text-[11px] text-muted" title="Notes">
              <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.75} />
              {post.notes.length}
            </span>
          )}
          <button
            type="button"
            onClick={toggleStar}
            aria-pressed={isMine}
            aria-label={isMine ? "Remove from my favorites" : "Add to my favorites"}
            className="rounded-md p-1 text-faint transition-colors hover:text-gold"
          >
            <Star className={cn("h-4 w-4", isMine && "fill-gold text-gold")} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {error && <p className="pb-2 pl-6 text-xs text-danger">{error}</p>}

      {open && (
        <PostDetail
          post={post}
          boards={boards}
          boardSet={boardSet}
          people={people}
          currentUserId={currentUserId}
          href={href}
          onTag={onTag}
          onToggleBoard={toggleBoard}
          isPending={isPending}
        />
      )}
    </li>
  );
}

function PostDetail({
  post,
  boards,
  boardSet,
  people,
  currentUserId,
  href,
  onTag,
  onToggleBoard,
  isPending,
}: {
  post: InspoPost;
  boards: InspoBoard[];
  boardSet: Set<string>;
  people: Record<string, string>;
  currentUserId: string;
  href: string | null;
  onTag: (tag: string) => void;
  onToggleBoard: (boardId: string) => void;
  isPending: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  function save(action: () => Promise<void>, after?: () => void) {
    setError(null);
    startSaving(async () => {
      try {
        await action();
        after?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  const details: [string, string][] = [
    ["Engagement rate", fmtRate(post.engagementRate)],
    ["Save rate", fmtRate(post.saveRate)],
    ["Share rate", fmtRate(post.shareRate)],
    ["Followers", fmtCount(post.creatorFollowers)],
    ...(post.durationSeconds ? [["Length", `${Math.round(post.durationSeconds)}s`] as [string, string]] : []),
    ...(post.slideCount ? [["Slides", String(post.slideCount)] as [string, string]] : []),
    ["Posted", post.postedAt ? formatDate(post.postedAt) : "—"],
    ["Topic", TOPIC_LABEL[post.topic] ?? post.topic],
    ["Found via", post.sourceQuery ?? "—"],
  ];

  return (
    <div className="space-y-4 pb-4 pl-6 pr-1">
      <div className="space-y-2">
        {post.caption && (
          <p className="whitespace-pre-wrap break-words rounded-md border-l-2 border-accent/40 bg-surface-2/60 px-3 py-2 text-[13px] leading-relaxed">
            {post.caption}
          </p>
        )}
        {post.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {post.hashtags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onTag(tag)}
                className="rounded-full border border-edge px-2 py-0.5 text-[11px] text-muted transition-colors hover:border-edge-strong hover:text-ink"
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
        {post.sound && (
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Music2 className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
            <span className="break-words">{post.sound}</span>
          </p>
        )}
      </div>

      {post.favoritedBy.length > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <Star className="h-3.5 w-3.5 fill-gold text-gold" strokeWidth={1.75} />
          Starred by{" "}
          {post.favoritedBy
            .map((id) => (id === currentUserId ? "you" : people[id] ?? "a founder"))
            .join(", ")}
        </p>
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-5">
        {details.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-[10px] uppercase tracking-wider text-faint">{label}</dt>
            <dd className="tnum truncate text-[13px]">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-center gap-2">
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-md border border-accent bg-accent px-3 py-1.5 text-xs text-bg transition-opacity hover:opacity-90"
          >
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />
            Open on {post.platform === "tiktok" ? "TikTok" : "Instagram"}
          </a>
        )}
        <BriefButton kind="post" id={post.id} label="Carousel brief" />
        <button
          type="button"
          onClick={() => save(() => setHidden(post.id, !post.hidden))}
          disabled={isSaving}
          className="flex items-center gap-1.5 rounded-md border border-edge px-3 py-1.5 text-xs text-muted transition-colors hover:text-ink disabled:opacity-60"
        >
          {post.hidden ? <Eye className="h-3.5 w-3.5" strokeWidth={1.75} /> : <EyeOff className="h-3.5 w-3.5" strokeWidth={1.75} />}
          {post.hidden ? "Unhide" : "Hide (not relevant)"}
        </button>
      </div>

      <div>
        <p className="mb-1.5 text-[10px] uppercase tracking-wider text-faint">Boards</p>
        {boards.length === 0 ? (
          <p className="text-xs text-faint">No boards yet — create one with “+ Board” above the list.</p>
        ) : (
          <div className={cn("flex flex-wrap gap-1.5", isPending && "opacity-80")}>
            {boards.map((b) => {
              const on = boardSet.has(b.id);
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => onToggleBoard(b.id)}
                  aria-pressed={on}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
                    on ? "border-accent bg-accent/10 text-accent" : "border-edge text-muted hover:text-ink"
                  )}
                >
                  {on ? "✓ " : "+ "}
                  {b.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <p className="mb-1.5 text-[10px] uppercase tracking-wider text-faint">Notes</p>
        {post.notes.length > 0 && (
          <ul className="mb-2 space-y-1.5">
            {post.notes.map((n) => (
              <li key={n.id} className="group rounded-md bg-surface-2/60 px-3 py-2">
                <div className="mb-0.5 flex items-center gap-2 text-[11px] text-faint">
                  <span className="font-medium text-muted">{people[n.authorId] ?? "Founder"}</span>
                  <span>{formatRelativeTime(n.createdAt)}</span>
                  {n.authorId === currentUserId && (
                    <button
                      type="button"
                      onClick={() => save(() => deleteNote(n.id))}
                      aria-label="Delete note"
                      className="ml-auto text-faint opacity-0 transition-opacity hover:text-danger focus:opacity-100 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                  )}
                </div>
                <p className="whitespace-pre-wrap break-words text-[13px]">{n.body}</p>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={2000}
            rows={2}
            placeholder="What's worth stealing here? Hook, format, caption, sound…"
            className="min-w-0 flex-1 resize-y rounded-md border border-edge bg-surface px-2 py-1.5 text-xs outline-none focus:border-edge-strong"
          />
          <button
            type="button"
            disabled={!draft.trim() || isSaving}
            onClick={() => save(() => addNote(post.id, draft), () => setDraft(""))}
            className="rounded-md border border-edge px-3 py-1.5 text-xs text-ink transition-colors hover:border-edge-strong disabled:opacity-50"
          >
            Add note
          </button>
        </div>
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      </div>
    </div>
  );
}
