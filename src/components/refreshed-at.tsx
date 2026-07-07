import { getAllAuthUsers } from "@/lib/data/users";
import { getStripeMetrics, getLifetimeRevenue } from "@/lib/data/stripe-metrics";
import { getAnthropicMetrics } from "@/lib/data/anthropic-metrics";
import { formatRelativeTime } from "@/lib/format";
import { LiveDot } from "@/components/ui/live-dot";

// Oldest fetchedAt across every cached data source — an honest "as of"
// timestamp rather than "now" (which would just be when the page rendered).
export async function RefreshedAt() {
  const [users, stripe, revenue, anthropic] = await Promise.all([
    getAllAuthUsers(),
    getStripeMetrics(),
    getLifetimeRevenue(),
    getAnthropicMetrics(),
  ]);

  const oldest = [users.fetchedAt, stripe.fetchedAt, revenue.fetchedAt, anthropic.fetchedAt].sort()[0];

  return (
    <p className="flex items-center gap-2 font-mono text-xs text-faint">
      <LiveDot tone="accent" />
      <span className="tnum">{formatRelativeTime(oldest)}</span>
    </p>
  );
}

export function RefreshedAtSkeleton() {
  return (
    <p className="flex items-center gap-2 font-mono text-xs text-faint">
      <span className="inline-flex h-2 w-2 rounded-full bg-faint/50" />—
    </p>
  );
}
