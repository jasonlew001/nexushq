"use client";

import { useMemo, useState } from "react";
import {
  ComposedChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/cn";
import { startOfWeekUTC } from "@/lib/format";
import {
  CHART_GRID,
  CHART_TEXT_MUTED,
  CHART_ACCENT,
  CHART_SURFACE,
  CATEGORICAL,
  tooltipContentStyle,
  tooltipLabelStyle,
} from "./chart-theme";
import type { DailyCost, DailyUsage } from "@/lib/data/anthropic-metrics";

type Granularity = "daily" | "weekly";

function shortDateLabel(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function bucketKey(dateStr: string, granularity: Granularity): string {
  if (granularity === "daily") return dateStr;
  return startOfWeekUTC(new Date(`${dateStr}T00:00:00Z`));
}

function aggregateCost(data: DailyCost[], granularity: Granularity) {
  const map = new Map<string, number>();
  for (const d of data) {
    const key = bucketKey(d.date, granularity);
    map.set(key, (map.get(key) ?? 0) + d.costCents);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, costCents]) => ({ date, label: shortDateLabel(date), costDollars: costCents / 100 }));
}

function aggregateUsage(data: DailyUsage[], granularity: Granularity) {
  const map = new Map<string, { inputTokens: number; cachedInputTokens: number; outputTokens: number }>();
  for (const d of data) {
    const key = bucketKey(d.date, granularity);
    const existing = map.get(key) ?? { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 };
    existing.inputTokens += d.inputTokens;
    existing.cachedInputTokens += d.cachedInputTokens;
    existing.outputTokens += d.outputTokens;
    map.set(key, existing);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => ({ date, label: shortDateLabel(date), ...v }));
}

export function AnthropicCostChart({
  dailyCost,
  dailyUsage,
}: {
  dailyCost: DailyCost[];
  dailyUsage: DailyUsage[];
}) {
  const [granularity, setGranularity] = useState<Granularity>("daily");

  const costRows = useMemo(() => aggregateCost(dailyCost, granularity), [dailyCost, granularity]);
  const usageRows = useMemo(() => aggregateUsage(dailyUsage, granularity), [dailyUsage, granularity]);

  return (
    <div>
      <div className="mb-3 flex justify-end gap-1">
        {(["daily", "weekly"] as const).map((g) => (
          <button
            key={g}
            onClick={() => setGranularity(g)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs capitalize transition-colors",
              granularity === g
                ? "bg-accent/10 text-accent"
                : "text-faint hover:text-muted"
            )}
          >
            {g}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs text-muted">Cost (USD)</p>
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={costRows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={CHART_GRID} strokeDasharray="0" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: CHART_TEXT_MUTED, fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: CHART_GRID }}
              />
              <YAxis
                tick={{ fill: CHART_TEXT_MUTED, fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={40}
                tickFormatter={(v: number) => `$${v}`}
              />
              <Tooltip
                contentStyle={tooltipContentStyle}
                labelStyle={tooltipLabelStyle}
                formatter={(value) => [`$${Number(value).toFixed(2)}`, "Cost"]}
                cursor={{ stroke: CHART_GRID, strokeWidth: 1 }}
              />
              <Line
                type="monotone"
                dataKey="costDollars"
                stroke={CHART_ACCENT}
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div>
          <p className="mb-2 text-xs text-muted">Token usage</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={usageRows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={CHART_GRID} strokeDasharray="0" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: CHART_TEXT_MUTED, fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: CHART_GRID }}
              />
              <YAxis
                tick={{ fill: CHART_TEXT_MUTED, fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={40}
                tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`)}
              />
              <Tooltip
                contentStyle={tooltipContentStyle}
                labelStyle={tooltipLabelStyle}
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
              />
              <Legend wrapperStyle={{ fontSize: 10, color: CHART_TEXT_MUTED, paddingTop: 4 }} />
              <Bar
                dataKey="inputTokens"
                name="Input"
                stackId="tokens"
                fill={CATEGORICAL[0]}
                stroke={CHART_SURFACE}
                strokeWidth={2}
                maxBarSize={20}
              />
              <Bar
                dataKey="cachedInputTokens"
                name="Cached input"
                stackId="tokens"
                fill={CATEGORICAL[1]}
                stroke={CHART_SURFACE}
                strokeWidth={2}
                maxBarSize={20}
              />
              <Bar
                dataKey="outputTokens"
                name="Output"
                stackId="tokens"
                fill={CATEGORICAL[4]}
                stroke={CHART_SURFACE}
                strokeWidth={2}
                maxBarSize={20}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
