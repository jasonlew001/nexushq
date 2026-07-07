import { cn } from "@/lib/cn";

const TONE_BG: Record<"accent" | "gold" | "danger" | "warn", string> = {
  accent: "bg-accent",
  gold: "bg-gold",
  danger: "bg-danger",
  warn: "bg-warn",
};

// Radar-style pulse: a solid dot with an expanding, fading ring behind it.
export function LiveDot({ tone = "accent" }: { tone?: "accent" | "gold" | "danger" | "warn" }) {
  return (
    <span className="relative inline-flex h-2 w-2">
      <span
        className={cn(
          "absolute inline-flex h-full w-full rounded-full opacity-75 motion-safe:animate-ping",
          TONE_BG[tone]
        )}
      />
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", TONE_BG[tone])} />
    </span>
  );
}
