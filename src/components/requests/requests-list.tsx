"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronRight, Mail, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { updateRequestTriage } from "@/actions/requests";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { REQUEST_STATUSES, type RequestStatus } from "@/lib/constants";
import { cn } from "@/lib/cn";
import type { ContactRequest } from "@/lib/data/requests";

type View = "open" | RequestStatus | "all";

const VIEWS: { key: View; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "new", label: "New" },
  { key: "in_progress", label: "In progress" },
  { key: "resolved", label: "Resolved" },
  { key: "all", label: "All" },
];

const STATUS_LABEL: Record<RequestStatus, string> = {
  new: "New",
  in_progress: "In progress",
  resolved: "Resolved",
};

const STATUS_TONE: Record<RequestStatus, "gold" | "warn" | "neutral"> = {
  new: "gold",
  in_progress: "warn",
  resolved: "neutral",
};

function matchesView(status: RequestStatus, view: View): boolean {
  if (view === "all") return true;
  if (view === "open") return status !== "resolved";
  return status === view;
}

// Built from the user's own address/subject, but always a mailto: href, so
// untrusted input can't turn it into another scheme.
function replyHref(req: ContactRequest): string {
  return `mailto:${encodeURIComponent(req.email)}?subject=${encodeURIComponent(`Re: ${req.subject}`)}`;
}

function RequestDetail({
  req,
  triageAvailable,
}: {
  req: ContactRequest;
  triageAvailable: boolean;
}) {
  const [note, setNote] = useState(req.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save(status: RequestStatus) {
    setError(null);
    startTransition(async () => {
      try {
        await updateRequestTriage(req.id, { status, note: note || null });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  return (
    <div className="space-y-3 pb-3 pl-6 pr-1">
      <p className="whitespace-pre-wrap break-words rounded-md border-l-2 border-accent/40 bg-surface-2/60 px-3 py-2 text-[13px] leading-relaxed">
        {req.message}
      </p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="break-all">{req.email}</span>
        <span className="tnum">{formatDate(req.createdAt)}</span>
        <a
          href={replyHref(req)}
          className="flex items-center gap-1 text-accent hover:underline"
        >
          <Mail className="h-3.5 w-3.5" strokeWidth={1.75} />
          Reply by email
        </a>
      </div>

      {triageAvailable ? (
        <div className="space-y-2">
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-faint">
              Internal note
            </label>
            <textarea
              maxLength={1000}
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Only visible in HQ"
              className="w-full resize-y rounded-md border border-edge bg-surface px-2 py-1.5 text-xs outline-none focus:border-edge-strong"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {REQUEST_STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                disabled={isPending}
                onClick={() => save(status)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-xs transition-colors disabled:opacity-50",
                  status === req.status
                    ? "border-accent bg-accent text-bg"
                    : "border-edge text-muted hover:text-ink"
                )}
              >
                {status === req.status ? `Save as ${STATUS_LABEL[status]}` : `Mark ${STATUS_LABEL[status]}`}
              </button>
            ))}
            {req.triagedAt && (
              <span className="ml-1 text-[11px] text-faint">
                updated {formatRelativeTime(req.triagedAt)}
              </span>
            )}
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      ) : (
        <p className="text-xs text-faint">
          Status tracking is off until sql/004_contact_requests.sql is run.
        </p>
      )}
    </div>
  );
}

export function RequestsList({
  requests,
  triageAvailable,
}: {
  requests: ContactRequest[];
  triageAvailable: boolean;
}) {
  const [view, setView] = useState<View>("open");
  const [subject, setSubject] = useState("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const subjects = useMemo(
    () => Array.from(new Set(requests.map((r) => r.subject))).sort(),
    [requests]
  );

  const counts = useMemo(() => {
    const c = {} as Record<View, number>;
    for (const v of VIEWS) c[v.key] = requests.filter((r) => matchesView(r.status, v.key)).length;
    return c;
  }, [requests]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return requests.filter(
      (r) =>
        matchesView(r.status, view) &&
        (subject === "all" || r.subject === subject) &&
        (!q ||
          r.name.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          r.message.toLowerCase().includes(q))
    );
  }, [requests, view, subject, query]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => setView(v.key)}
            aria-pressed={view === v.key}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs transition-colors",
              view === v.key ? "bg-surface-2 font-medium text-ink" : "text-muted hover:text-ink"
            )}
          >
            {v.label}
            <span className="tnum ml-1.5 text-faint">{counts[v.key]}</span>
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, or message"
            className="w-full rounded-md border border-edge bg-surface-2 py-1.5 pl-8 pr-2 text-xs outline-none focus:border-edge-strong"
          />
        </div>
        <select
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="rounded-md border border-edge bg-surface-2 px-2 py-1.5 text-xs outline-none"
        >
          <option value="all">All subjects</option>
          {subjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          label={requests.length === 0 ? "No requests yet" : "Nothing matches this view"}
          hint={requests.length === 0 ? "Contact form submissions will show up here." : undefined}
        />
      ) : (
        <div className="divide-y divide-edge">
          {visible.map((req) => {
            const isOpen = openId === req.id;
            return (
              <div key={req.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : req.id)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-2 py-2.5 text-left"
                >
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 shrink-0 text-faint transition-transform",
                      isOpen && "rotate-90"
                    )}
                    strokeWidth={1.75}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p
                        className={cn(
                          "truncate text-sm",
                          req.status === "new" && "font-medium"
                        )}
                      >
                        {req.name}
                      </p>
                      <Badge tone="neutral">{req.subject}</Badge>
                      {triageAvailable && (
                        <Badge tone={STATUS_TONE[req.status]}>{STATUS_LABEL[req.status]}</Badge>
                      )}
                    </div>
                    {!isOpen && (
                      <p className="truncate text-xs text-faint">
                        {req.note ? `Note: ${req.note}` : req.message}
                      </p>
                    )}
                  </div>
                  <span className="tnum shrink-0 text-xs text-faint">
                    {formatRelativeTime(req.createdAt)}
                  </span>
                </button>
                {isOpen && <RequestDetail req={req} triageAvailable={triageAvailable} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
