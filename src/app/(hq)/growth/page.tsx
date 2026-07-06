import { Suspense } from "react";
import { requireFounder } from "@/lib/auth";
import { PageShell } from "@/components/page-shell";
import { Card, SectionLabel } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getSignupMetrics } from "@/lib/data/signups";
import { SignupsByWeekChart } from "@/components/charts/signups-by-week";
import { SourceBarChart } from "@/components/charts/source-bar-chart";
import { SignupsByStateChart } from "@/components/charts/signups-by-state";

export const dynamic = "force-dynamic";

async function GrowthCharts() {
  const signups = await getSignupMetrics();

  return (
    <div className="stagger space-y-4">
      <Card>
        <SectionLabel>Signups by week — by UTM source</SectionLabel>
        <SignupsByWeekChart data={signups.weekly} topUtmSources={signups.topUtmSources} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionLabel>Acquisition — UTM source (all signups)</SectionLabel>
          <SourceBarChart
            data={signups.utmBreakdown}
            order={signups.topUtmSources}
            kind="utm"
            emptyLabel="No attribution data yet"
          />
        </Card>
        <Card>
          <SectionLabel>Acquisition — how they heard about us (paying customers only)</SectionLabel>
          <SourceBarChart
            data={signups.hearAboutUsBreakdown}
            order={signups.hearAboutUsBreakdown.map((b) => b.source)}
            kind="acq"
            emptyLabel="No survey responses yet"
          />
        </Card>
      </div>

      <Card>
        <SectionLabel>Signups by state</SectionLabel>
        <SignupsByStateChart data={signups.byState} unknownCount={signups.unknownStateCount} />
      </Card>
    </div>
  );
}

export default async function GrowthPage() {
  await requireFounder();

  return (
    <PageShell title="Growth" description="Signups, acquisition sources, and geography">
      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-[280px] w-full rounded-lg" />
            <div className="grid gap-4 lg:grid-cols-2">
              <Skeleton className="h-[220px] w-full rounded-lg" />
              <Skeleton className="h-[220px] w-full rounded-lg" />
            </div>
          </div>
        }
      >
        <GrowthCharts />
      </Suspense>
    </PageShell>
  );
}
