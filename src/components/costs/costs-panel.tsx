import { Card, SectionLabel } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getAnthropicMetrics } from "@/lib/data/anthropic-metrics";
import { getStripeMetrics } from "@/lib/data/stripe-metrics";
import {
  getManualCosts,
  monthlyBurnCents,
  perPersonMonthlyCents,
  serviceMonthlyBreakdown,
  PEOPLE,
  UNASSIGNED,
} from "@/lib/data/costs";
import { formatCentsWhole, formatCentsPrecise, formatPercent } from "@/lib/format";
import { ANTHROPIC_KEY_ROTATION_CAVEAT } from "@/lib/constants";
import { AnthropicCostChart } from "@/components/charts/anthropic-cost-chart";
import {
  CostsVsRevenueChart,
  type CostsVsRevenueRow,
} from "@/components/charts/costs-vs-revenue";
import { ManualCostsChart } from "@/components/charts/manual-costs-chart";
import { CostsTable } from "./costs-table";
import { CostEntryForm } from "./cost-entry-form";

const PERSON_LABEL: Record<string, string> = {
  nick: "Nick",
  jason: "Jason",
  kamp: "Kamp",
  [UNASSIGNED]: "Unassigned",
};

export async function CostsPanel() {
  const [anthropic, stripe, manualCosts] = await Promise.all([
    getAnthropicMetrics(),
    getStripeMetrics(),
    getManualCosts(),
  ]);
  const { data: metrics } = anthropic;

  const now = new Date();
  const monthKey = now.toISOString().slice(0, 7);
  const manualMonthlyCents = Math.round(monthlyBurnCents(manualCosts, monthKey));
  const totalBurnCents = metrics.monthToDateCents + manualMonthlyCents;

  // Per-month rows for costs-vs-revenue. Manual costs are today's active
  // entries applied to each month (one-times land in their own month) —
  // there's no cost-history table, so past months reflect current values;
  // footnoted under the chart. Revenue joins by month key from the Stripe
  // lifecycle reconstruction.
  const revenueByMonth = new Map(stripe.data.mrrByMonth.map((m) => [m.month, m.mrrCents]));
  const costsVsRevenue: CostsVsRevenueRow[] = metrics.monthlyCost.map((m) => ({
    month: m.month,
    anthropicCents: m.costCents,
    manualCents: Math.round(monthlyBurnCents(manualCosts, m.month)),
    revenueCents: revenueByMonth.get(m.month) ?? 0,
  }));

  // Manual costs by service, per month, over the same window — plus a
  // stable service order (largest current contributor first) for colors.
  const monthKeys = metrics.monthlyCost.map((m) => m.month);
  const manualByService = serviceMonthlyBreakdown(manualCosts, monthKeys);
  const serviceTotals = new Map<string, number>();
  for (const row of manualByService) {
    for (const [service, cents] of Object.entries(row.byService)) {
      serviceTotals.set(service, (serviceTotals.get(service) ?? 0) + cents);
    }
  }
  const services = Array.from(serviceTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([service]) => service);

  // Who fronts what this month (combos split evenly).
  const perPerson = perPersonMonthlyCents(manualCosts, monthKey);
  const perPersonEntries = [...PEOPLE, UNASSIGNED]
    .filter((p) => (perPerson[p] ?? 0) > 0)
    .map((p) => ({ person: p, cents: Math.round(perPerson[p]) }));

  const trendPct =
    metrics.previousMonthCents > 0
      ? (metrics.monthToDateCents - metrics.previousMonthCents) / metrics.previousMonthCents
      : null;

  return (
    <div className="stagger space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <div className="mb-1.5 flex items-center gap-2">
            <p className="text-[11px] uppercase tracking-wider text-muted">Anthropic spend (MTD)</p>
            <Badge tone="accent">live</Badge>
          </div>
          <p className="tnum text-xl font-semibold">{formatCentsWhole(metrics.monthToDateCents)}</p>
          <p className={`tnum mt-1 text-xs ${trendPct != null && trendPct >= 0 ? "text-warn" : "text-accent"}`}>
            {trendPct == null ? "—" : `${trendPct >= 0 ? "+" : ""}${formatPercent(trendPct)} vs last month`}
          </p>
        </Card>

        <Card>
          <p className="mb-1.5 text-[11px] uppercase tracking-wider text-muted">Manual costs (monthly-equiv.)</p>
          <p className="tnum text-xl font-semibold">{formatCentsWhole(manualMonthlyCents)}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <Badge tone="neutral">manual</Badge>
            {perPersonEntries.map(({ person, cents }) => (
              <span key={person} className="tnum text-xs text-muted">
                {PERSON_LABEL[person]} {formatCentsPrecise(cents)}
              </span>
            ))}
          </div>
        </Card>

        <Card>
          <p className="mb-1.5 text-[11px] uppercase tracking-wider text-muted">Total burn (month-to-date)</p>
          <p className="tnum text-xl font-semibold text-gold">{formatCentsWhole(totalBurnCents)}</p>
          <p className="mt-1 text-xs text-faint">Anthropic MTD + manual monthly-equivalent</p>
        </Card>
      </div>

      <Card>
        <SectionLabel>Costs vs monthly revenue</SectionLabel>
        <CostsVsRevenueChart rows={costsVsRevenue} />
        <p className="mt-3 text-xs text-faint">
          Revenue is the approximate MRR reconstruction (current prices); manual costs are
          today&apos;s active entries applied to each month — no cost history is kept.
        </p>
      </Card>

      <Card>
        <SectionLabel>Manual costs by service</SectionLabel>
        <ManualCostsChart rows={manualByService} services={services} />
        <p className="mt-3 text-xs text-faint">
          Today&apos;s entries applied at current values — one-time costs land in their own
          month; no cost history is kept.
        </p>
      </Card>

      <Card>
        <SectionLabel>Anthropic API cost & token usage</SectionLabel>
        <AnthropicCostChart dailyCost={metrics.dailyCost} dailyUsage={metrics.dailyUsage} />
        <p className="mt-3 text-xs text-faint">{ANTHROPIC_KEY_ROTATION_CAVEAT}</p>
      </Card>

      <Card>
        <SectionLabel>Manual costs</SectionLabel>
        <CostsTable costs={manualCosts} />
        <CostEntryForm />
      </Card>
    </div>
  );
}

export function CostsPanelSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-[260px] w-full rounded-lg" />
      <Skeleton className="h-40 w-full rounded-lg" />
    </div>
  );
}
