"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { WeeklySignupBucket } from "@/lib/data/signups";
import {
  CHART_GRID,
  CHART_TEXT_MUTED,
  CHART_SURFACE,
  colorForCategory,
  utmSourceLabel,
  tooltipContentStyle,
  tooltipLabelStyle,
} from "./chart-theme";

function shortWeekLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function SignupsByWeekChart({
  data,
  topUtmSources,
}: {
  data: WeeklySignupBucket[];
  topUtmSources: string[];
}) {
  if (data.length === 0) return null;

  // Stable series order: known top sources first, then other/unattributed —
  // matches the fixed color assignment so a source's color never shifts.
  const seriesKeys = [...topUtmSources, "other", "unattributed"].filter((key) =>
    data.some((week) => week.byUtmSource[key] > 0)
  );

  const rows = data.map((week) => ({
    weekStart: week.weekStart,
    label: shortWeekLabel(week.weekStart),
    ...week.byUtmSource,
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={rows} barCategoryGap="20%">
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
          formatter={(value, name) => [value, utmSourceLabel(String(name))]}
          cursor={{ fill: "rgba(255,255,255,0.03)" }}
        />
        {seriesKeys.length > 1 && (
          <Legend
            wrapperStyle={{ fontSize: 11, color: CHART_TEXT_MUTED, paddingTop: 8 }}
            formatter={(value: string) => utmSourceLabel(value)}
          />
        )}
        {seriesKeys.map((key) => (
          <Bar
            key={key}
            dataKey={key}
            stackId="signups"
            fill={colorForCategory(key, topUtmSources)}
            stroke={CHART_SURFACE}
            strokeWidth={2}
            maxBarSize={24}
            radius={
              key === seriesKeys[seriesKeys.length - 1] ? [4, 4, 0, 0] : [0, 0, 0, 0]
            }
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
