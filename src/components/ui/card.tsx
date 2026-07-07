import { cn } from "@/lib/cn";

type HudTone = "accent" | "gold" | "danger" | "warn" | "neutral";

const HUD_COLOR: Record<HudTone, string> = {
  accent: "hsl(var(--accent) / 0.55)",
  gold: "hsl(var(--gold) / 0.55)",
  danger: "hsl(var(--danger) / 0.55)",
  warn: "hsl(var(--warn) / 0.55)",
  neutral: "hsl(var(--edge-strong) / 0.9)",
};

export function Card({
  className,
  children,
  hud = false,
  hudTone = "accent",
}: {
  className?: string;
  children: React.ReactNode;
  /** Opt-in HUD corner brackets — used on the overview page's live-stat cards. */
  hud?: boolean;
  hudTone?: HudTone;
}) {
  return (
    <div
      className={cn("rounded-lg border border-edge bg-surface p-4", hud && "hud-corners", className)}
      style={hud ? ({ "--hud-color": HUD_COLOR[hudTone] } as React.CSSProperties) : undefined}
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
