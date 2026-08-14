import { Card, SectionLabel } from "@/components/ui/card";
import { Skeleton, ShellCard } from "@/components/ui/skeleton";
import { getSignupMetrics } from "@/lib/data/signups";
import { getStripeMetrics } from "@/lib/data/stripe-metrics";
import { OverviewTrendChart } from "@/components/charts/overview-trend-chart";
import { MrrOverTimeChart } from "@/components/charts/mrr-over-time";
import { SignupFunnel } from "./signup-funnel";
import { PlanMixBar } from "./plan-mix-bar";
import { AttributionSplitBar } from "./attribution-split-bar";
import { InstagramCard } from "./instagram-card";

// Row 2: two stacked trend charts (signups, MRR) beside a breakdown panel
// (funnel, plan mix, attribution, Instagram). The left column used to be a
// single chart card that CSS Grid stretched to match the taller right
// stack, leaving empty space below the chart — a second chart fills that
// height with real content instead of padding.
export async function TrendRow() {
  const [signups, stripe] = await Promise.all([getSignupMetrics(), getStripeMetrics()]);
  const { data: stripeMetrics } = stripe;

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
      <div className="flex flex-col gap-4">
        <Card>
          <SectionLabel>Signups</SectionLabel>
          <OverviewTrendChart weekly={signups.weekly} daily={signups.dailySignups} />
        </Card>

        <Card>
          <SectionLabel>MRR over time</SectionLabel>
          <MrrOverTimeChart data={stripeMetrics.mrrOverTime} />
        </Card>
      </div>

      <div className="flex flex-col gap-4">
        <Card>
          <SectionLabel>Funnel</SectionLabel>
          {/* paying comes from stripeMetrics, not signups.payingSubscribers —
              same live Stripe count the KPI card above shows, so the two
              never disagree. signups.payingSubscribers reads the DB's
              webhook-replicated tier/status instead, which can lag Stripe's
              live state by however long the last webhook took to land. */}
          <SignupFunnel signups={signups.totalSignups} paying={stripeMetrics.payingSubscriberCount} />
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
      <div className="flex flex-col gap-4">
        <ShellCard className="h-[340px]">
          <div className="mb-3 flex items-center justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-40 rounded-md" />
          </div>
          <Skeleton className="h-[244px] w-full" />
        </ShellCard>
        <ShellCard className="h-[300px]">
          <div className="mb-3 flex justify-end">
            <Skeleton className="h-6 w-32 rounded-md" />
          </div>
          <Skeleton className="h-[240px] w-full" />
        </ShellCard>
      </div>
      <div className="flex flex-col gap-4">
        <ShellCard className="h-[104px]">
          <Skeleton className="mb-3 h-3 w-16" />
          <Skeleton className="h-2 w-full rounded-full" />
          <Skeleton className="mx-auto mt-2 h-2 w-24" />
          <Skeleton className="mt-2 h-2 w-full rounded-full" />
        </ShellCard>
        <ShellCard className="h-[88px]">
          <Skeleton className="mb-3 h-3 w-16" />
          <Skeleton className="h-2 w-full rounded-full" />
        </ShellCard>
        <ShellCard className="h-[88px]">
          <Skeleton className="mb-3 h-3 w-40" />
          <Skeleton className="h-2 w-full rounded-full" />
        </ShellCard>
        <ShellCard className="flex h-[72px] items-start gap-3">
          <Skeleton className="h-7 w-7 shrink-0 rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-full" />
          </div>
        </ShellCard>
      </div>
    </div>
  );
}
