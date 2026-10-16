"use client";

import { useState, useTransition } from "react";
import { setOwnPostTheme } from "@/actions/inspiration";
import { INSPO_THEMES } from "@/lib/constants";
import { cn } from "@/lib/cn";

// Inline theme correction for one of our posts; saving marks it founder-set
// so the daily sync stops re-tagging it.
export function OwnThemeSelect({
  postId,
  theme,
  setByFounder,
}: {
  postId: string;
  theme: string | null;
  setByFounder: boolean;
}) {
  const [value, setValue] = useState(theme ?? "");
  const [error, setError] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <select
      value={value}
      aria-label="Theme"
      title={error ? "Couldn't save — try again" : setByFounder ? "Set by a founder" : "Auto-tagged — change if wrong"}
      disabled={isPending}
      onChange={(e) => {
        const next = e.target.value;
        const prev = value;
        setValue(next);
        setError(false);
        startTransition(async () => {
          try {
            await setOwnPostTheme(postId, next || null);
          } catch {
            setValue(prev);
            setError(true);
          }
        });
      }}
      className={cn(
        "max-w-[11rem] rounded-md border bg-surface px-1.5 py-1 text-[11px] outline-none focus:border-edge-strong",
        error ? "border-danger text-danger" : "border-edge",
        !setByFounder && "text-muted",
        isPending && "opacity-60"
      )}
    >
      <option value="">No theme</option>
      {INSPO_THEMES.map((t) => (
        <option key={t.key} value={t.key}>
          {t.label}
        </option>
      ))}
    </select>
  );
}
