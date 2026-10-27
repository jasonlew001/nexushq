import { Card, SectionLabel } from "@/components/ui/card";
import { Skeleton, ShellCard } from "@/components/ui/skeleton";
import { getSignupMetrics } from "@/lib/data/signups";
import { getStripeMetrics } from "@/lib/data/stripe-metrics";
import { OverviewTrendChart } from "@/components/charts/overview-trend-chart";
import { SignupFunnel } from "./signup-funnel";
import { PlanMixBar } from "./plan-mix-bar";
import { AttributionSplitBar } from "./attribution-split-bar";

// Row 2: the signups chart beside one "Conversion" panel (funnel, plan mix,
// attribution as hairline-separated sections of a single panel rather than
// three stacked mini-cards). The MRR-over-time chart lives on /revenue now;
// the pulse band above already carries MRR's trend line.
export async function TrendRow() {
  const [signups, stripe] = await Promise.all([getSignupMetrics(), getStripeMetrics()]);
  const { data: stripeMetrics } = stripe;

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
      <Card className="p-5">
        <SectionLabel>Signups</SectionLabel>
        <OverviewTrendChart weekly={signups.weekly} daily={signups.dailySignups} />
      </Card>

      <Card className="divide-y divide-edge p-0">
        <div className="p-5">
          <SectionLabel>Conversion</SectionLabel>
          {/* paying comes from stripeMetrics, not signups.payingSubscribers —
              same live Stripe count the pulse band shows, so the two never
              disagree. signups.payingSubscribers reads the DB's
              webhook-replicated tier/status instead, which can lag Stripe. */}
          <SignupFunnel signups={signups.totalSignups} paying={stripeMetrics.payingSubscriberCount} />
        </div>
        <div className="p-5">
          <SectionLabel>Plan mix</SectionLabel>
          <PlanMixBar plans={stripeMetrics.planBreakdown} />
        </div>
        <div className="p-5">
          <SectionLabel aside="last complete week">Attribution</SectionLabel>
          <AttributionSplitBar
            tracked={signups.lastCompleteWeekAttribution.tracked}
            unknown={signups.lastCompleteWeekAttribution.unknown}
          />
        </div>
      </Card>
    </section>
  );
}

export function TrendRowSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
      <ShellCard className="h-[352px] p-5">
        <div className="mb-3 flex items-center justify-between">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-6 w-40 rounded-md" />
        </div>
        <Skeleton className="h-[244px] w-full" />
      </ShellCard>
      <ShellCard className="h-[352px] space-y-8 p-5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-2 w-full rounded-full" />
      </ShellCard>
    </div>
  );
}
