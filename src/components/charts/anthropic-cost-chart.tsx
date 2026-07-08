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
  tooltipItemStyle,
} from "./chart-theme";
import { ToggleChips } from "./toggle-chips";
import type { DailyCost, DailyUsage } from "@/lib/data/anthropic-metrics";

type Granularity = "daily" | "weekly";

// The data layer fetches COST_HISTORY_MONTHS (~6 months) of daily buckets
// for the costs-vs-revenue chart; ~180 daily bars is unreadable here, so
// the daily view trims to this trailing window. Weekly shows everything.
const DAILY_VIEW_DAYS = 60;

const TOKEN_SERIES = [
  { key: "inputTokens", label: "Input", color: CATEGORICAL[0] },
  { key: "cachedInputTokens", label: "Cached input", color: CATEGORICAL[1] },
  { key: "outputTokens", label: "Output", color: CATEGORICAL[4] },
] as const;

type TokenSeriesKey = (typeof TOKEN_SERIES)[number]["key"];

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

function dailyCutoff(granularity: Granularity): string {
  if (granularity !== "daily") return "";
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - DAILY_VIEW_DAYS);
  return d.toISOString().slice(0, 10);
}

function aggregateCost(data: DailyCost[], granularity: Granularity) {
  const cutoff = dailyCutoff(granularity);
  const map = new Map<string, number>();
  for (const d of data) {
    if (d.date < cutoff) continue;
    const key = bucketKey(d.date, granularity);
    map.set(key, (map.get(key) ?? 0) + d.costCents);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, costCents]) => ({ date, label: shortDateLabel(date), costDollars: costCents / 100 }));
}

function aggregateUsage(data: DailyUsage[], granularity: Granularity) {
  const cutoff = dailyCutoff(granularity);
  const map = new Map<string, { inputTokens: number; cachedInputTokens: number; outputTokens: number }>();
  for (const d of data) {
    if (d.date < cutoff) continue;
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
  const [activeTokenSeries, setActiveTokenSeries] = useState<Set<string>>(
    new Set(TOKEN_SERIES.map((s) => s.key))
  );

  const costRows = useMemo(() => aggregateCost(dailyCost, granularity), [dailyCost, granularity]);
  const usageRows = useMemo(() => aggregateUsage(dailyUsage, granularity), [dailyUsage, granularity]);

  function toggleTokenSeries(key: string) {
    setActiveTokenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next.size === 0 ? new Set(TOKEN_SERIES.map((s) => s.key)) : next;
    });
  }

  const visibleTokenSeries = TOKEN_SERIES.filter((s) => activeTokenSeries.has(s.key));
  const lastVisibleKey: TokenSeriesKey | undefined = visibleTokenSeries.at(-1)?.key;

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
          <p className="mb-2 text-xs text-muted">
            Cost (USD{granularity === "daily" ? `, last ${DAILY_VIEW_DAYS} days` : ""})
          </p>
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
                itemStyle={tooltipItemStyle}
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
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted">Token usage</p>
            <ToggleChips
              options={TOKEN_SERIES.map((s) => ({ key: s.key, label: s.label, color: s.color }))}
              active={activeTokenSeries}
              onToggle={toggleTokenSeries}
            />
          </div>
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
                itemStyle={tooltipItemStyle}
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
              />
              {visibleTokenSeries.map((series) => (
                <Bar
                  key={series.key}
                  dataKey={series.key}
                  name={series.label}
                  stackId="tokens"
                  fill={series.color}
                  stroke={CHART_SURFACE}
                  strokeWidth={2}
                  maxBarSize={20}
                  radius={series.key === lastVisibleKey ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
