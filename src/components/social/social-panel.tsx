import Link from "next/link";
import { Instagram } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton, ShellCard } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { getInstagramMetrics } from "@/lib/data/instagram-metrics";
import { SocialTabs } from "./social-tabs";

export async function SocialPanel() {
  const { data } = await getInstagramMetrics();

  if (!data.connected) {
    return (
      <Card>
        <EmptyState
          icon={Instagram}
          label="Instagram isn't connected yet"
          hint="Connect the Nexus Golf Instagram account to see follower and engagement stats here."
        />
        <div className="flex justify-center">
          <Link
            href="/api/instagram/authorize"
            className="rounded-md bg-ink px-3.5 py-2 text-[13px] font-medium text-surface transition-opacity hover:opacity-90"
          >
            Connect Instagram
          </Link>
        </div>
      </Card>
    );
  }

  if (data.error) {
    return (
      <Card>
        <EmptyState icon={Instagram} label="Instagram data is temporarily unavailable" hint={data.error} />
      </Card>
    );
  }

  return (
    <SocialTabs
      followerCount={data.followerCount}
      mediaCount={data.mediaCount}
      insights={data.insights}
      followerHistory={data.followerHistory}
      reachHistory={data.reachHistory}
      recentMedia={data.recentMedia}
    />
  );
}

export function SocialPanelSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-4 border-b border-edge pb-2">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-12" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <ShellCard key={i} className="h-20">
            <Skeleton className="mb-1.5 h-3 w-20" />
            <Skeleton className="h-7 w-16" />
          </ShellCard>
        ))}
      </div>
      <ShellCard className="h-[280px]">
        <Skeleton className="mb-3 h-3 w-32" />
        <Skeleton className="h-[220px] w-full" />
      </ShellCard>
    </div>
  );
}
