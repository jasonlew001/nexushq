import { Suspense } from "react";
import { requireFounder } from "@/lib/auth";
import { SectionBoundary } from "@/components/ui/section-boundary";
import { PageShell } from "@/components/page-shell";
import { InspirationSwitcher } from "@/components/inspiration/inspiration-switcher";
import { OwnPostsPanel, OwnPostsPanelSkeleton } from "@/components/inspiration/own-posts-panel";
import type { OwnSort } from "@/lib/data/own-posts";

export const dynamic = "force-dynamic";

const SORTS: OwnSort[] = ["newest", "views", "index", "saves"];

export default async function OwnPostsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  await requireFounder();
  const raw = Array.isArray(searchParams.sort) ? searchParams.sort[0] : searchParams.sort;
  const sort = SORTS.includes(raw as OwnSort) ? (raw as OwnSort) : "newest";

  return (
    <PageShell
      title="Inspiration"
      description="What's working on our own TikTok and Instagram, by theme, hook and format"
    >
      <InspirationSwitcher active="ours" />
      <SectionBoundary label="Our posts">
        <Suspense fallback={<OwnPostsPanelSkeleton />}>
          <OwnPostsPanel sort={sort} />
        </Suspense>
      </SectionBoundary>
    </PageShell>
  );
}
