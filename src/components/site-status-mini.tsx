import Link from "next/link";
import { LiveDot } from "@/components/ui/live-dot";
import { getVercelDeploys, FAILED_STATES } from "@/lib/data/vercel-metrics";
import { formatRelativeTime } from "@/lib/format";

// Sidebar footer readout (on the brand-green rail): is the main site live,
// and what shipped last. Renders on every route, so like RefreshedAt it
// never throws: any failure (or no VERCEL_TOKEN) just renders nothing.
export async function SiteStatusMini() {
  let deploys;
  try {
    deploys = (await getVercelDeploys()).data;
  } catch (err) {
    console.error("SiteStatusMini: Vercel fetch failed", err);
    return null;
  }
  if (!deploys.connected || deploys.error || !deploys.live) return null;

  const failed = deploys.pending != null && FAILED_STATES.has(deploys.pending.state);
  const building = deploys.pending != null && !failed;

  return (
    <Link
      href="/site"
      className="group -mx-3 mb-3 block rounded-md px-3 py-2 text-xs transition-colors hover:bg-white/[0.05]"
    >
      <span className="flex items-center gap-2 font-medium text-white">
        <LiveDot tone={failed ? "danger" : building ? "gold" : "mint"} />
        {failed ? "Push didn't ship" : building ? "Deploying…" : "Site live"}
      </span>
      <span className="mt-0.5 block truncate pl-4 text-white/55">
        <span className="font-mono">{deploys.live.sha ?? "deploy"}</span> · {formatRelativeTime(deploys.live.createdAt)}
      </span>
    </Link>
  );
}
