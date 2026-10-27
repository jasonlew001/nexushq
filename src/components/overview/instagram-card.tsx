import Link from "next/link";
import { Instagram } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getInstagramMetrics } from "@/lib/data/instagram-metrics";
import { Sparkline } from "./mrr-sparkline";

// Real data once connected; a "Connect Instagram" prompt otherwise — the
// connect flow starts at /api/instagram/authorize (see src/app/api/instagram).
export async function InstagramCard() {
  const { data } = await getInstagramMetrics();

  if (!data.connected) {
    return (
      <Card className="flex items-start gap-3">
        <span className="rounded-md bg-surface-2 p-2">
          <Instagram className="h-4 w-4 text-muted" strokeWidth={1.75} />
        </span>
        <div>
          <p className="text-sm font-medium">Instagram</p>
          <Link href="/api/instagram/authorize" className="mt-0.5 block text-xs text-accent hover:underline">
            Connect Instagram →
          </Link>
        </div>
      </Card>
    );
  }

  if (data.error) {
    return (
      <Card className="flex items-start gap-3">
        <span className="rounded-md bg-surface-2 p-2">
          <Instagram className="h-4 w-4 text-faint" strokeWidth={1.75} />
        </span>
        <div>
          <p className="text-sm font-medium">Instagram</p>
          <p className="mt-0.5 text-xs text-faint">Temporarily unavailable — refreshes automatically.</p>
        </div>
      </Card>
    );
  }

  const recentPoints = data.followerHistory.slice(-30).map((p) => p.value);
  const weekAgo = data.followerHistory.length > 7 ? data.followerHistory.at(-8)!.value : null;
  const current = data.followerCount ?? recentPoints.at(-1) ?? 0;
  const deltaPct = weekAgo != null && weekAgo > 0 ? (current - weekAgo) / weekAgo : null;

  return (
    <Link href="/social" className="group block h-full">
      <Card className="flex h-full flex-col p-5 transition-colors hover:border-edge-strong">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold">Instagram</p>
          <Instagram className="h-4 w-4 text-faint transition-colors group-hover:text-ink" strokeWidth={1.75} />
        </div>
        <div className="mt-4 flex items-baseline gap-2.5">
          <p className="font-display text-[34px] leading-none">{current.toLocaleString()}</p>
          {deltaPct != null && (
            <span
              className={`tnum rounded-full px-1.5 py-0.5 text-xs font-medium ${
                deltaPct >= 0 ? "bg-accent/10 text-accent" : "bg-danger/10 text-danger"
              }`}
            >
              {deltaPct >= 0 ? "↑" : "↓"} {Math.abs(deltaPct * 100).toFixed(1)}%
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted">Followers, vs 7 days ago</p>
        {recentPoints.length >= 2 && (
          // Fills the height the row gives this card; 30 days of follower count.
          <div className="mt-4 flex min-h-[72px] flex-1 flex-col justify-end">
            <Sparkline points={recentPoints} colorVar="--accent" className="h-full max-h-[150px] min-h-[72px]" />
          </div>
        )}
        <p className="mt-3 border-t border-edge pt-3 text-xs text-faint">
          {data.mediaCount != null ? `${data.mediaCount.toLocaleString()} posts · ` : ""}last 30 days shown
        </p>
      </Card>
    </Link>
  );
}
