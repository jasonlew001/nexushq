import { Card, SectionLabel } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getSignupMetrics } from "@/lib/data/signups";
import { getStripeMetrics } from "@/lib/data/stripe-metrics";
import { OverviewTrendChart } from "@/components/charts/overview-trend-chart";
import { SignupFunnel } from "./signup-funnel";
import { PlanMixBar } from "./plan-mix-bar";
import { AttributionSplitBar } from "./attribution-split-bar";
import { InstagramCard } from "./instagram-card";

// Row 2: the big signups-by-week trend chart beside a stacked breakdown
// panel (funnel, plan mix, attribution) and the Instagram placeholder.
export async function TrendRow() {
  const [signups, stripe] = await Promise.all([getSignupMetrics(), getStripeMetrics()]);
  const { data: stripeMetrics } = stripe;

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
      <Card>
        <SectionLabel>Signups by week</SectionLabel>
        <OverviewTrendChart data={signups.weekly} />
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <SectionLabel>Funnel</SectionLabel>
          <SignupFunnel signups={signups.totalSignups} paying={signups.payingSubscribers} />
        </Card>

        <Card>
          <SectionLabel>Plan mix</SectionLabel>
          <PlanMixBar plans={stripeMetrics.planBreakdown} />
        </Card>

        <Card>
          <SectionLabel>Attribution (last complete week)</SectionLabel>
          <AttributionSplitBar
            tracked={signups.lastCompleteWeekAttribution.tracked}
            unknown={signups.lastCompleteWeekAttribution.unknown}
          />
        </Card>

        <InstagramCard />
      </div>
    </section>
  );
}

export function TrendRowSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
      <Skeleton className="h-[340px] w-full rounded-lg" />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-[104px] w-full rounded-lg" />
        <Skeleton className="h-[88px] w-full rounded-lg" />
        <Skeleton className="h-[88px] w-full rounded-lg" />
        <Skeleton className="h-[72px] w-full rounded-lg" />
      </div>
    </div>
  );
}
