import { cn } from "@/lib/cn";

// Hairline border only: a border AND a drop shadow on the same panel reads
// as generic dashboard chrome, and on this cool off-white the border alone
// separates surfaces fine.
export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("rounded-lg border border-edge bg-surface p-4", className)}>{children}</div>;
}

// Panel title. Sentence case at body size, not a tiny all-caps kicker: the
// title is the first thing read in a panel, so it should read like one.
export function SectionLabel({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-[13px] font-semibold tracking-[-0.005em] text-ink">{children}</h2>
      {aside ? <span className="text-xs text-faint">{aside}</span> : null}
    </div>
  );
}
