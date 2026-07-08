"use client";

import { cn } from "@/lib/cn";

export interface ChipOption {
  key: string;
  label: string;
  color?: string; // swatch shown on the chip; matches the series color
}

// Shared include/exclude control for charts: one chip per series (or per
// cohort filter). Active = filled with the series' swatch; inactive =
// struck-through and dimmed. Purely controlled — parent owns the Set.
export function ToggleChips({
  options,
  active,
  onToggle,
}: {
  options: ChipOption[];
  active: Set<string>;
  onToggle: (key: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {options.map((opt) => {
        const isOn = active.has(opt.key);
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onToggle(opt.key)}
            aria-pressed={isOn}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[11px] transition-colors",
              isOn
                ? "border-edge-strong bg-surface-2 text-ink"
                : "border-edge text-faint line-through hover:text-muted"
            )}
          >
            {opt.color && (
              <span
                className={cn("h-1.5 w-1.5 rounded-full", !isOn && "opacity-30")}
                style={{ backgroundColor: opt.color }}
              />
            )}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
