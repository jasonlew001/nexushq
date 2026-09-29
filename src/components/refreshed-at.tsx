import { getAllAuthUsers } from "@/lib/data/users";
import { getStripeMetrics } from "@/lib/data/stripe-metrics";
import { getAnthropicMetrics } from "@/lib/data/anthropic-metrics";
import { formatRelativeTime } from "@/lib/format";

// Oldest fetchedAt across the cached sources this label covers — an honest
// "as of" timestamp rather than "now" (which would just be when the page
// rendered).
//
// Deliberately excludes getLifetimeRevenue(): it walks every paid invoice
// (measured 6.0s cold) and this component sits in the sidebar, so including
// it stalled EVERY page — and every post-action re-render — for six seconds
// each time its hourly cache lapsed. It shares Anthropic's 1h TTL, so it
// almost never changed the answer anyway. /customers still reads it.
export async function RefreshedAt() {
  const [users, stripe, anthropic] = await Promise.all([
    getAllAuthUsers(),
    getStripeMetrics(),
    getAnthropicMetrics(),
  ]);

  const oldest = [users.fetchedAt, stripe.fetchedAt, anthropic.fetchedAt].sort()[0];

  return (
    <p className="text-xs text-faint">
      synced <span className="tnum">{formatRelativeTime(oldest)}</span>
    </p>
  );
}

export function RefreshedAtSkeleton() {
  return <p className="text-xs text-faint">synced —</p>;
}
