import { Suspense } from "react";
import { requireFounder } from "@/lib/auth";
import { PageShell } from "@/components/page-shell";
import { SocialPanel, SocialPanelSkeleton } from "@/components/social/social-panel";

export const dynamic = "force-dynamic";

export default async function SocialPage() {
  await requireFounder();

  return (
    <PageShell title="Social" description="Instagram follower growth and post engagement">
      <Suspense fallback={<SocialPanelSkeleton />}>
        <SocialPanel />
      </Suspense>
    </PageShell>
  );
}
