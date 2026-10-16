"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Copy, ExternalLink, FileText, X } from "lucide-react";
import { getPostBrief, getThemeBrief } from "@/actions/inspiration";
import { NEXUS_DESIGN_SYSTEM_URL } from "@/lib/constants";
import { cn } from "@/lib/cn";

// Builds a carousel brief and shows it in a dialog with a Copy button. The
// copy is its own click (a fresh user gesture), which clipboard access
// needs in every browser; writing right after an async fetch isn't reliable.
export function BriefButton({
  kind,
  id,
  label = "Carousel brief",
  className,
}: {
  kind: "theme" | "post";
  id: string;
  label?: string;
  className?: string;
}) {
  const [brief, setBrief] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyError, setCopyError] = useState(false);
  const [isPending, startTransition] = useTransition();
  const copyRef = useRef<HTMLButtonElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    copyRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    setOpen(false);
    setCopied(false);
    setCopyError(false);
    triggerRef.current?.focus();
  }

  function load() {
    setError(null);
    setOpen(true);
    if (brief) return;
    startTransition(async () => {
      try {
        setBrief(kind === "theme" ? await getThemeBrief(id) : await getPostBrief(id));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't build the brief");
      }
    });
  }

  async function copy() {
    if (!brief) return;
    setCopyError(false);
    try {
      await navigator.clipboard.writeText(brief);
      setCopied(true);
      return;
    } catch {
      // Clipboard API refused (permissions policy, embedded browser): fall
      // back to selecting the textarea and the legacy copy command.
    }
    const area = textRef.current;
    area?.focus();
    area?.select();
    if (area && document.execCommand("copy")) setCopied(true);
    else setCopyError(true); // text stays selected for Ctrl/Cmd+C
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={load}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border border-edge px-3 py-1.5 text-xs text-ink transition-colors hover:border-edge-strong",
          className
        )}
      >
        <FileText className="h-3.5 w-3.5" strokeWidth={1.75} />
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          onMouseDown={(e) => e.target === e.currentTarget && close()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`brief-title-${id}`}
            className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg border border-edge bg-surface shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-edge px-4 py-3">
              <h2 id={`brief-title-${id}`} className="text-sm font-semibold">
                Carousel brief
              </h2>
              <button type="button" onClick={close} aria-label="Close" className="rounded p-1 text-faint hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-4">
              {error ? (
                <p className="text-xs text-danger">{error}</p>
              ) : isPending || !brief ? (
                <p className="text-xs text-muted">Building the brief from the library…</p>
              ) : (
                <textarea
                  ref={textRef}
                  readOnly
                  value={brief}
                  aria-label="Brief text"
                  className="h-[50vh] w-full resize-none rounded-md border border-edge bg-surface-2/50 p-3 font-mono text-[11px] leading-relaxed outline-none"
                />
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-edge px-4 py-3">
              <p className={cn("text-[11px]", copyError ? "text-danger" : "text-muted")}>
                {copyError ? "Your browser blocked copying. The text is selected: press Ctrl+C (Cmd+C on Mac). " : "Paste into a Claude chat that has the design system. "}
                <a href={NEXUS_DESIGN_SYSTEM_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-accent hover:underline">
                  Open design system <ExternalLink className="h-3 w-3" />
                </a>
              </p>
              <button
                ref={copyRef}
                type="button"
                onClick={copy}
                disabled={!brief}
                className="inline-flex items-center gap-1.5 rounded-md border border-accent bg-accent px-3 py-1.5 text-xs text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy brief"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
