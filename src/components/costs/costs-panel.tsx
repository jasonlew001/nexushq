import { Card, SectionLabel } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getAnthropicMetrics } from "@/lib/data/anthropic-metrics";
import { getManualCosts, monthlyBurnCents } from "@/lib/data/costs";
import { formatCentsWhole, formatPercent } from "@/lib/format";
import { ANTHROPIC_KEY_ROTATION_CAVEAT } from "@/lib/constants";
import { AnthropicCostChart } from "@/components/charts/anthropic-cost-chart";
import { CostsTable } from "./costs-table";
import { CostEntryForm } from "./cost-entry-form";

export async function CostsPanel() {
  const [anthropic, manualCosts] = await Promise.all([getAnthropicMetrics(), getManualCosts()]);
  const { data: metrics } = anthropic;

  const now = new Date();
  const monthKey = now.toISOString().slice(0, 7);
  const manualMonthlyCents = Math.round(monthlyBurnCents(manualCosts, monthKey));
  const totalBurnCents = metrics.monthToDateCents + manualMonthlyCents;

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
          <Badge tone="neutral">manual</Badge>
        </Card>

        <Card>
          <p className="mb-1.5 text-[11px] uppercase tracking-wider text-muted">Total burn (month-to-date)</p>
          <p className="tnum text-xl font-semibold text-gold">{formatCentsWhole(totalBurnCents)}</p>
          <p className="mt-1 text-xs text-faint">Anthropic MTD + manual monthly-equivalent</p>
        </Card>
      </div>

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
