"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { WeeklySignupBucket } from "@/lib/data/signups";
import {
  CHART_GRID,
  CHART_TEXT_MUTED,
  CHART_ACCENT,
  tooltipContentStyle,
  tooltipLabelStyle,
  tooltipItemStyle,
  tooltipCursorFill,
} from "./chart-theme";

function shortWeekLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// The Overview page's big trend chart: total signups per week, single
// series, rendered with a top-saturated-to-transparent gradient fill.
export function OverviewTrendChart({ data }: { data: WeeklySignupBucket[] }) {
  const rows = data.slice(-12).map((week) => ({
    label: shortWeekLabel(week.weekStart),
    total: week.total,
  }));

  if (rows.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={rows} barCategoryGap="28%">
        <defs>
          <linearGradient id="overviewTrendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_ACCENT} stopOpacity={0.95} />
            <stop offset="100%" stopColor={CHART_ACCENT} stopOpacity={0.08} />
          </linearGradient>
        </defs>
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
          width={32}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={tooltipContentStyle}
          labelStyle={tooltipLabelStyle}
          itemStyle={tooltipItemStyle}
          formatter={(value) => [value, "Signups"]}
          cursor={tooltipCursorFill}
        />
        <Bar
          dataKey="total"
          fill="url(#overviewTrendFill)"
          radius={[6, 6, 0, 0]}
          maxBarSize={36}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
