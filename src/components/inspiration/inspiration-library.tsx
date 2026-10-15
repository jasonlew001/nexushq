"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lightbulb, Plus, Search, Star, Trash2, X } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { ToggleChips } from "@/components/charts/toggle-chips";
import { createBoard, deleteBoard } from "@/actions/inspiration";
import {
  INSPO_BIG_ACCOUNT_FOLLOWERS,
  INSPO_PAGE_SIZE,
  INSPO_SORTS,
  INSPO_TOPICS,
  type InspoSort,
  type InspoTopic,
} from "@/lib/constants";
import {
  INSPO_FAV_SCOPES,
  INSPO_PLATFORMS,
  INSPO_SINCE,
  INSPO_TABS,
  inspoHref,
  type InspoFilters,
  type InspoPlatform,
  type InspoSince,
  type InspoTab,
} from "@/lib/inspiration-filters";
import { cn } from "@/lib/cn";
import type { InspoPage } from "@/lib/data/inspiration";
import { PostRow, ROW_GRID, fmtCount } from "./post-row";

// Desktop column headers double as sort buttons.
const COLUMNS: { label: string; sort: InspoSort }[] = [
  { label: "Views", sort: "views" },
  { label: "Likes", sort: "likes" },
  { label: "Comments", sort: "comments" },
  { label: "Shares", sort: "shares" },
  { label: "Saves", sort: "saves" },
  { label: "Outlier", sort: "outlier" },
];

function TabButton({
  active,
  onClick,
  children,
  muted,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-1 whitespace-nowrap border-b-2 px-3 py-2 text-[13px] font-medium transition-colors",
        active ? "border-accent text-ink" : "border-transparent hover:text-ink",
        !active && (muted ? "text-faint" : "text-muted")
      )}
    >
      {children}
    </button>
  );
}

const selectClass =
  "rounded-md border border-edge bg-surface px-2 py-1.5 text-xs text-ink outline-none focus:border-edge-strong";

export function InspirationLibrary({
  filters,
  data,
  currentUserId,
}: {
  filters: InspoFilters;
  data: InspoPage;
  currentUserId: string;
}) {
  const router = useRouter();
  const [isNavigating, startNav] = useTransition();
  const [search, setSearch] = useState(filters.q);
  const [newBoard, setNewBoard] = useState<string | null>(null);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [isBoardPending, startBoard] = useTransition();

  // The q this input last pushed — so the URL catching up doesn't clobber
  // what's been typed since. Any other q change (Clear all, chip ×) syncs in.
  const pushedQ = useRef(filters.q);
  useEffect(() => {
    if (filters.q !== pushedQ.current) setSearch(filters.q);
    pushedQ.current = filters.q;
  }, [filters.q]);

  // Every filter change resets to page 1 unless the change *is* the page.
  function go(patch: Partial<InspoFilters>) {
    const next = { ...filters, page: 1, ...patch };
    // Paging jumps back to the top of the list; filter tweaks keep your place.
    startNav(() => router.push(inspoHref(next), { scroll: patch.page !== undefined }));
  }

  // Search applies as you type (no Enter needed, and clearing the box clears
  // the filter). "#tag" waits for Enter so half-typed tags don't flash 0 results.
  useEffect(() => {
    const q = search.trim();
    if (q === filters.q || q.startsWith("#")) return;
    const t = setTimeout(() => {
      pushedQ.current = q;
      go({ q });
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function toggleIn<T extends string>(list: T[], key: T, all: readonly T[]): T[] {
    const next = list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
    return next.length ? next : [...all]; // never filter down to nothing
  }

  function submitBoard() {
    const name = newBoard?.trim();
    if (!name) return;
    setBoardError(null);
    startBoard(async () => {
      try {
        const id = await createBoard(name);
        setNewBoard(null);
        go({ tab: `board:${id}` as InspoTab });
      } catch (err) {
        setBoardError(err instanceof Error ? err.message : "Failed to create board");
      }
    });
  }

  function removeBoard(id: string, name: string) {
    if (!window.confirm(`Delete board “${name}”? Posts stay in the library.`)) return;
    startBoard(async () => {
      try {
        await deleteBoard(id);
        go({ tab: "all" });
      } catch (err) {
        setBoardError(err instanceof Error ? err.message : "Failed to delete board");
      }
    });
  }

  const totalPages = Math.max(1, Math.ceil(data.total / INSPO_PAGE_SIZE));
  const activeBoard = filters.tab.startsWith("board:")
    ? data.boards.find((b) => `board:${b.id}` === filters.tab)
    : undefined;
  const topicKeys = INSPO_TOPICS.map((t) => t.key) as InspoTopic[];
  const platformKeys = INSPO_PLATFORMS.map((p) => p.key) as InspoPlatform[];

  // Every non-default filter as a removable chip, so it's always obvious why
  // the list is shorter than the library.
  const activeFilters: { key: string; label: string; clear: Partial<InspoFilters> }[] = [];
  if (filters.q) activeFilters.push({ key: "q", label: `Search: “${filters.q}”`, clear: { q: "" } });
  if (filters.tag) activeFilters.push({ key: "tag", label: `#${filters.tag}`, clear: { tag: "" } });
  if (filters.topics.length !== topicKeys.length) {
    const names = INSPO_TOPICS.filter((t) => filters.topics.includes(t.key)).map((t) => t.label);
    activeFilters.push({ key: "topics", label: `Topics: ${names.join(", ")}`, clear: { topics: topicKeys } });
  }
  if (filters.platforms.length !== platformKeys.length) {
    const names = INSPO_PLATFORMS.filter((p) => filters.platforms.includes(p.key)).map((p) => p.label);
    activeFilters.push({ key: "platforms", label: `${names.join(", ")} only`, clear: { platforms: platformKeys } });
  }
  if (filters.since !== "all") {
    const label = INSPO_SINCE.find((s) => s.key === filters.since)?.label ?? filters.since;
    activeFilters.push({ key: "since", label: `Posted in last ${label}`, clear: { since: "all" } });
  }
  if (filters.big) activeFilters.push({ key: "big", label: "Including big accounts", clear: { big: false } });

  function clearAllFilters() {
    setSearch("");
    go({ q: "", tag: "", topics: topicKeys, platforms: platformKeys, since: "all", big: false });
  }

  return (
    <div className="space-y-4">
      {/* Tabs: formats, favorites, one per board, then Hidden. */}
      <div className="flex items-end gap-1 overflow-x-auto border-b border-edge">
        {INSPO_TABS.filter((t) => t.key !== "hidden").map((t) => (
          <TabButton key={t.key} active={filters.tab === t.key} onClick={() => go({ tab: t.key })}>
            {t.key === "favorites" && <Star className="h-3.5 w-3.5" strokeWidth={1.75} />}
            {t.label}
          </TabButton>
        ))}
        {data.boards.map((b) => (
          <TabButton key={b.id} active={filters.tab === `board:${b.id}`} onClick={() => go({ tab: `board:${b.id}` as InspoTab })}>
            {b.name}
            <span className="tnum text-[11px] text-faint">{b.postCount}</span>
          </TabButton>
        ))}
        {newBoard === null ? (
          <button
            type="button"
            onClick={() => setNewBoard("")}
            className="flex shrink-0 items-center gap-1 whitespace-nowrap px-3 py-2 text-[13px] text-faint transition-colors hover:text-ink"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
            Board
          </button>
        ) : (
          <form
            className="flex shrink-0 items-center gap-1 px-2 py-1"
            onSubmit={(e) => {
              e.preventDefault();
              submitBoard();
            }}
          >
            <input
              autoFocus
              value={newBoard}
              onChange={(e) => setNewBoard(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setNewBoard(null)}
              maxLength={60}
              placeholder="Board name, e.g. Hook ideas"
              className="w-48 rounded-md border border-edge bg-surface px-2 py-1 text-xs outline-none focus:border-edge-strong"
            />
            <button type="submit" disabled={isBoardPending || !newBoard.trim()} className="rounded-md px-2 py-1 text-xs text-accent disabled:opacity-50">
              Create
            </button>
            <button type="button" onClick={() => setNewBoard(null)} aria-label="Cancel" className="p-1 text-faint hover:text-ink">
              <X className="h-3.5 w-3.5" />
            </button>
          </form>
        )}
        <div className="ml-auto" />
        <TabButton active={filters.tab === "hidden"} onClick={() => go({ tab: "hidden" })} muted>
          Hidden
        </TabButton>
      </div>
      {boardError && <p className="text-xs text-danger">{boardError}</p>}

      {/* Filters */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <form
            className="relative min-w-0 flex-1 basis-56"
            onSubmit={(e) => {
              e.preventDefault();
              const q = search.trim();
              // "#tag" in the search box is a hashtag filter, not caption text.
              if (q.startsWith("#") && !q.includes(" ")) go({ tag: q.slice(1).toLowerCase(), q: "" });
              else go({ q });
            }}
          >
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" strokeWidth={1.75} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search captions or creators, or #hashtag + Enter"
              className={cn(
                "w-full rounded-md border bg-surface py-1.5 pl-8 pr-7 text-xs outline-none",
                filters.q ? "border-accent/60 bg-accent/5" : "border-edge focus:border-edge-strong"
              )}
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  if (filters.q) go({ q: "" });
                }}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-faint hover:text-ink"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </form>
          <label className="flex items-center gap-1.5 text-xs text-muted">
            Sort
            <select value={filters.sort} onChange={(e) => go({ sort: e.target.value as InspoSort })} className={selectClass}>
              {INSPO_SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted">
            Posted
            <select value={filters.since} onChange={(e) => go({ since: e.target.value as InspoSince })} className={selectClass}>
              {INSPO_SINCE.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <ToggleChips
            options={INSPO_TOPICS.map((t) => ({ key: t.key, label: t.label }))}
            active={new Set(filters.topics)}
            onToggle={(k) => go({ topics: toggleIn(filters.topics, k as InspoTopic, topicKeys) })}
          />
          <ToggleChips
            options={INSPO_PLATFORMS.map((p) => ({ key: p.key, label: p.label }))}
            active={new Set(filters.platforms)}
            onToggle={(k) => go({ platforms: toggleIn(filters.platforms, k as InspoPlatform, platformKeys) })}
          />
          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted">
            <input type="checkbox" checked={filters.big} onChange={(e) => go({ big: e.target.checked })} className="accent-[hsl(var(--accent))]" />
            Include big accounts ({fmtCount(INSPO_BIG_ACCOUNT_FOLLOWERS)}+ followers)
          </label>
        </div>

        {activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-accent/30 bg-accent/5 px-2.5 py-1.5">
            <span className="text-[11px] font-medium text-accent">Filtering by</span>
            {activeFilters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => {
                  if (f.key === "q") setSearch("");
                  go(f.clear);
                }}
                aria-label={`Remove filter: ${f.label}`}
                className="flex max-w-full items-center gap-1 rounded-full border border-accent/30 bg-surface px-2 py-0.5 text-[11px] text-accent transition-colors hover:border-accent"
              >
                <span className="truncate">{f.label}</span>
                <X className="h-3 w-3 shrink-0" />
              </button>
            ))}
            <button
              type="button"
              onClick={clearAllFilters}
              className="ml-auto text-[11px] text-muted underline-offset-2 hover:text-ink hover:underline"
            >
              Clear all
            </button>
          </div>
        )}

        {(filters.tab === "favorites" || activeBoard) && (
          <div className="flex flex-wrap items-center gap-2">
            {filters.tab === "favorites" &&
              INSPO_FAV_SCOPES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => go({ fav: s.key })}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs transition-colors",
                    filters.fav === s.key ? "bg-accent/10 text-accent" : "text-faint hover:text-muted"
                  )}
                >
                  {s.label}
                </button>
              ))}
            {activeBoard && (
              <button
                type="button"
                onClick={() => removeBoard(activeBoard.id, activeBoard.name)}
                className="ml-auto flex items-center gap-1 text-[11px] text-faint transition-colors hover:text-danger"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                Delete board
              </button>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      <div className={cn("transition-opacity", isNavigating && "opacity-50")}>
        <div className="mb-1 flex items-center justify-between text-xs text-muted">
          <span className="tnum">
            {data.total.toLocaleString()} {activeFilters.length > 0 ? "matching posts" : "posts"}
            {isNavigating && <span className="ml-2 text-faint">Updating…</span>}
          </span>
          {totalPages > 1 && (
            <span className="tnum">
              Page {filters.page} of {totalPages}
            </span>
          )}
        </div>

        <div className={cn("hidden border-b border-edge pb-2 text-[11px] uppercase tracking-wider text-faint", ROW_GRID)}>
          <span className="pl-6">Post</span>
          {COLUMNS.map((c) => (
            <button
              key={c.sort}
              type="button"
              onClick={() => go({ sort: c.sort })}
              className={cn("text-right uppercase transition-colors hover:text-ink", filters.sort === c.sort && "text-accent")}
            >
              {c.label}
              {filters.sort === c.sort ? " ↓" : ""}
            </button>
          ))}
          <span />
        </div>

        {data.posts.length === 0 ? (
          <EmptyState
            icon={Lightbulb}
            label={
              data.libraryEmpty
                ? "The library is empty"
                : filters.tab === "favorites"
                  ? "No favorites here yet"
                  : activeBoard
                    ? "Nothing on this board yet"
                    : "No posts match these filters"
            }
            hint={
              data.libraryEmpty
                ? "Run node scripts/import-inspiration.mjs to pull posts."
                : filters.tab === "favorites" || activeBoard
                  ? "Open a post and star it or add it to a board."
                  : "Try turning topics back on, a wider date range, or including big accounts."
            }
          />
        ) : (
          <ul>
            {data.posts.map((post) => (
              <PostRow
                key={post.id}
                post={post}
                boards={data.boards}
                people={data.people}
                currentUserId={currentUserId}
                onTag={(tag) => go({ tag })}
              />
            ))}
          </ul>
        )}

        {totalPages > 1 && (
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={filters.page <= 1}
              onClick={() => go({ page: filters.page - 1 })}
              className="rounded-md border border-edge px-3 py-1.5 text-xs text-muted transition-colors hover:text-ink disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={filters.page >= totalPages}
              onClick={() => go({ page: filters.page + 1 })}
              className="rounded-md border border-edge px-3 py-1.5 text-xs text-muted transition-colors hover:text-ink disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
