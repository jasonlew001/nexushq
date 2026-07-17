// Real per-plan subscriber counts from stripe-metrics.ts → planBreakdown.
// Segment widths are proportional to subscriberCount — never fabricated.
const PLAN_COLOR: Record<string, string> = {
  Monthly: "#C9A227",
  Annual: "#94741F",
  "6-Month": "#5F4B14",
};

function colorFor(label: string): string {
  return PLAN_COLOR[label] ?? "hsl(var(--muted))";
}

export function PlanMixBar({
  plans,
}: {
  plans: { label: string; subscriberCount: number }[];
}) {
  const total = plans.reduce((sum, p) => sum + p.subscriberCount, 0);

  if (total === 0) {
    return <p className="text-xs text-faint">No paying subscriptions yet</p>;
  }

  return (
    <div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-2">
        {plans.map((p, i) => (
          <div
            key={p.label}
            style={{
              width: `${(p.subscriberCount / total) * 100}%`,
              backgroundColor: colorFor(p.label),
              borderRight: i < plans.length - 1 ? "2px solid hsl(var(--surface))" : undefined,
            }}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-muted">
        {plans.map((p) => (
          <span key={p.label} className="flex items-center gap-1.5">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: colorFor(p.label) }}
            />
            {p.subscriberCount} {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}
