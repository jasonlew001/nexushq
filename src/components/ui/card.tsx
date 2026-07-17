import { cn } from "@/lib/cn";

type HudTone = "accent" | "gold" | "danger" | "warn" | "neutral";

export function Card({
  className,
  children,
  hud = false,
  hudTone = "accent",
}: {
  className?: string;
  children: React.ReactNode;
  /** @deprecated no-op, retained until every call site drops it in Phase 6. */
  hud?: boolean;
  /** @deprecated no-op, retained until every call site drops it in Phase 6. */
  hudTone?: HudTone;
}) {
  void hud;
  void hudTone;
  return (
    <div
      className={cn(
        "rounded-lg border border-edge bg-surface p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 font-mono text-[11px] font-medium uppercase tracking-wider text-muted">
      <span className="text-faint">// </span>
      {children}
    </h2>
  );
}
