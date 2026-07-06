import { Card, SectionLabel } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getSignupMetrics } from "@/lib/data/signups";
import { getStripeMetrics } from "@/lib/data/stripe-metrics";
import { getCustomerRows } from "@/lib/data/customers";
import { colorForCategory, utmSourceLabel, acqSourceLabel } from "./chart-theme";
import { SignupsByWeekChart } from "./signups-by-week";
import { MrrOverTimeChart } from "./mrr-over-time";
import { SourceBarChart } from "./source-bar-chart";
import { TierDistributionChart } from "./tier-distribution";
import { SignupsByStateChart } from "./signups-by-state";

export async function ChartsSection() {
  const [signups, stripe, customers] = await Promise.all([
    getSignupMetrics(),
    getStripeMetrics(),
    getCustomerRows(),
  ]);

  const freeCount = customers.filter((c) => c.tier === "free" || !c.tier).length;
  const premiumCount = customers.filter((c) => c.tier === "premium").length;

  return (
    <div className="stagger space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionLabel>Signups by week — by UTM source</SectionLabel>
          <SignupsByWeekChart data={signups.weekly} topUtmSources={signups.topUtmSources} />
        </Card>
        <Card>
          <SectionLabel>MRR over time (approximate)</SectionLabel>
          <MrrOverTimeChart data={stripe.data.mrrOverTime} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionLabel>Acquisition — UTM source (all signups)</SectionLabel>
          <SourceBarChart
            data={signups.utmBreakdown}
            colorFor={(key) => colorForCategory(key, signups.topUtmSources)}
            labelFor={utmSourceLabel}
            emptyLabel="No attribution data yet"
          />
        </Card>
        <Card>
          <SectionLabel>Acquisition — how they heard about us (paying customers only)</SectionLabel>
          <SourceBarChart
            data={signups.hearAboutUsBreakdown}
            colorFor={(key) =>
              colorForCategory(
                key,
                signups.hearAboutUsBreakdown.map((b) => b.source)
              )
            }
            labelFor={acqSourceLabel}
            emptyLabel="No survey responses yet"
          />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionLabel>Tier distribution</SectionLabel>
          <TierDistributionChart free={freeCount} premium={premiumCount} />
        </Card>
        <Card>
          <SectionLabel>Signups by state</SectionLabel>
          <SignupsByStateChart data={signups.byState} unknownCount={signups.unknownStateCount} />
        </Card>
      </div>
    </div>
  );
}

export function ChartsSectionSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-[240px] w-full rounded-lg" />
          <Skeleton className="h-[240px] w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}
