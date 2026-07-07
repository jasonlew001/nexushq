import { getAllAuthUsers } from "@/lib/data/users";
import { getStripeMetrics, getLifetimeRevenue } from "@/lib/data/stripe-metrics";
import { getAnthropicMetrics } from "@/lib/data/anthropic-metrics";
import { formatRelativeTime } from "@/lib/format";

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
    <p className="font-mono text-xs text-faint">
      synced <span className="tnum">{formatRelativeTime(oldest)}</span>
    </p>
  );
}

export function RefreshedAtSkeleton() {
  return <p className="font-mono text-xs text-faint">synced —</p>;
}
