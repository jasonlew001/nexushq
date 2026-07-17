import { cn } from "@/lib/cn";

// Exact final dimensions passed via className — the point of a skeleton is
// zero layout shift when real content swaps in.
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-md bg-[linear-gradient(110deg,hsl(var(--surface-2))_8%,hsl(var(--edge))_18%,hsl(var(--surface-2))_33%)] bg-[length:200%_100%] motion-safe:animate-shimmer",
        className
      )}
    />
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg border border-edge bg-surface p-4", className)}>
      <Skeleton className="mb-3 h-3 w-24" />
      <Skeleton className="h-7 w-20" />
    </div>
  );
}

// The "empty outlined shell" stage of the load-in choreography: real card
// chrome (border, radius, bg) at the final layout's exact height, with
// placeholder content passed in as children. Because the chrome matches the
// live Card component, there's zero layout shift when real content resolves.
export function ShellCard({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-lg border border-edge bg-surface p-4", className)}>{children}</div>
  );
}
