import { cn } from "@/lib/cn";

type BadgeTone = "neutral" | "accent" | "gold" | "danger" | "warn";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-surface-2 text-muted border-edge",
  accent: "bg-accent/10 text-accent border-accent/20",
  gold: "bg-gold/10 text-gold border-gold/20",
  danger: "bg-danger/10 text-danger border-danger/20",
  warn: "bg-warn/10 text-warn border-warn/20",
};

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        TONES[tone]
      )}
    >
      {children}
    </span>
  );
}
