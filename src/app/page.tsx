import { Suspense } from "react";
import { requireFounder } from "@/lib/auth";
import { Header } from "@/components/header";
import { ActionStrip, ActionStripSkeleton } from "@/components/action-strip";
import { KpiRow, KpiRowSkeleton } from "@/components/kpi-row";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireFounder();

  // TODO(Phase 9): replace with the oldest fetchedAt across all cached
  // sources once Stripe/Anthropic fetchers land (Phases 5 & 7).
  const refreshedAt = new Date().toISOString();

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <Header refreshedAt={refreshedAt} />

      <div className="space-y-6">
        <Suspense fallback={<ActionStripSkeleton />}>
          <ActionStrip />
        </Suspense>

        <Suspense fallback={<KpiRowSkeleton />}>
          <KpiRow />
        </Suspense>
      </div>
    </main>
  );
}
