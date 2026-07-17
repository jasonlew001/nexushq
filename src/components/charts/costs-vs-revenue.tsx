"use client";

import { useMemo, useState } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  CHART_GRID,
  CHART_TEXT_MUTED,
  CHART_GOLD,
  CHART_SURFACE,
  CATEGORICAL,
  NULL_GRAY,
  tooltipContentStyle,
  tooltipLabelStyle,
  tooltipItemStyle,
  tooltipCursorFill,
} from "./chart-theme";
import { ToggleChips } from "./toggle-chips";
import { RangeTabs } from "./range-tabs";

export interface CostsVsRevenueRow {
  month: string; // YYYY-MM
  anthropicCents: number;
  manualCents: number;
  revenueCents: number;
}

const SERIES = [
  { key: "anthropic", label: "Anthropic", color: CATEGORICAL[0] },
  { key: "manual", label: "Manual costs", color: NULL_GRAY },
  { key: "revenue", label: "Revenue (MRR)", color: CHART_GOLD },
] as const;

const RANGES = [
  { key: "3", label: "3m" },
  { key: "6", label: "6m" },
  { key: "12", label: "12m" },
] as const;

function monthLabel(month: string, isCurrent: boolean): string {
  const label = new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
  return isCurrent ? `${label} (MTD)` : label;
}

// Stacked cost bars (Anthropic live + manual) against a gold MRR line, per
// calendar month. All three series toggleable — hiding one re-scales the
// rest. Rows arrive fully computed from the server (manual costs need the
// server-only data layer).
export function CostsVsRevenueChart({ rows }: { rows: CostsVsRevenueRow[] }) {
  const [active, setActive] = useState<Set<string>>(new Set(SERIES.map((s) => s.key)));
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("6");

  const currentMonth = rows.at(-1)?.month;
  const chartRows = useMemo(
    () =>
      rows.slice(-Number(range)).map((r) => ({
        label: monthLabel(r.month, r.month === currentMonth),
        anthropic: r.anthropicCents / 100,
        manual: r.manualCents / 100,
        revenue: r.revenueCents / 100,
      })),
    [rows, range, currentMonth]
  );

  function toggle(key: string) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      // Never allow an empty chart — re-add rather than strand the user.
      return next.size === 0 ? new Set(SERIES.map((s) => s.key)) : next;
    });
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <ToggleChips
          options={SERIES.map((s) => ({ key: s.key, label: s.label, color: s.color }))}
          active={active}
          onToggle={toggle}
        />
        <RangeTabs options={RANGES} active={range} onChange={setRange} />
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={chartRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={CHART_GRID} strokeDasharray="0" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: CHART_TEXT_MUTED, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: CHART_GRID }}
          />
          <YAxis
            tick={{ fill: CHART_TEXT_MUTED, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={(v: number) => `$${v.toLocaleString()}`}
          />
          <Tooltip
            contentStyle={tooltipContentStyle}
            labelStyle={tooltipLabelStyle}
            itemStyle={tooltipItemStyle}
            formatter={(value, name) => [
              `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
              String(name),
            ]}
            cursor={tooltipCursorFill}
          />
          {active.has("anthropic") && (
            <Bar
              dataKey="anthropic"
              name="Anthropic"
              stackId="costs"
              fill={CATEGORICAL[0]}
              stroke={CHART_SURFACE}
              strokeWidth={2}
              maxBarSize={24}
              radius={active.has("manual") ? [0, 0, 0, 0] : [4, 4, 0, 0]}
            />
          )}
          {active.has("manual") && (
            <Bar
              dataKey="manual"
              name="Manual costs"
              stackId="costs"
              fill={NULL_GRAY}
              stroke={CHART_SURFACE}
              strokeWidth={2}
              maxBarSize={24}
              radius={[4, 4, 0, 0]}
            />
          )}
          {active.has("revenue") && (
            <Line
              type="monotone"
              dataKey="revenue"
              name="Revenue (MRR)"
              stroke={CHART_GOLD}
              strokeWidth={2}
              dot={{ r: 3, fill: CHART_GOLD, stroke: CHART_SURFACE, strokeWidth: 2 }}
              activeDot={{ r: 5, fill: CHART_GOLD, stroke: CHART_SURFACE, strokeWidth: 2 }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
