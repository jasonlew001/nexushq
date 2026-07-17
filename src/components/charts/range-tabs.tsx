"use client";

import { cn } from "@/lib/cn";

export interface RangeOption<K extends string = string> {
  key: K;
  label: string;
}

// Shared date-range selector — same look as the daily/weekly toggle the
// Anthropic chart introduced, generalized. Controlled by the parent chart;
// slicing happens client-side over the server-provided (widest) window.
export function RangeTabs<K extends string>({
  options,
  active,
  onChange,
}: {
  options: readonly RangeOption<K>[];
  active: K;
  onChange: (key: K) => void;
}) {
  return (
    <div className="flex gap-1">
      {options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          className={cn(
            "whitespace-nowrap rounded-md px-2.5 py-1 text-xs transition-colors",
            active === opt.key ? "bg-accent/10 text-accent" : "text-faint hover:text-muted"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
