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
    <Card className="overflow-hidden">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted">Instagram followers</p>
          <p className="tnum mt-1.5 text-2xl font-semibold leading-none">{current.toLocaleString()}</p>
          {deltaPct != null && (
            <p className={`mt-1 text-xs ${deltaPct >= 0 ? "text-accent" : "text-danger"}`}>
              {deltaPct >= 0 ? "▲" : "▼"} {Math.abs(deltaPct * 100).toFixed(1)}% vs 7 days ago
            </p>
          )}
        </div>
        <span className="rounded-md bg-surface-2 p-1.5">
          <Instagram className="h-4 w-4 text-muted" strokeWidth={1.75} />
        </span>
      </div>
      {recentPoints.length >= 2 && (
        <div className="-mx-4 -mb-4 mt-3">
          <Sparkline points={recentPoints} colorVar="--accent" />
        </div>
      )}
    </Card>
  );
}
