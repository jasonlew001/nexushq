"use client";

import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { WeeklySignupBucket, DailySignupBucket } from "@/lib/data/signups";
import {
  CHART_GRID,
  CHART_TEXT_MUTED,
  CHART_ACCENT,
  tooltipContentStyle,
  tooltipLabelStyle,
  tooltipItemStyle,
  tooltipCursorFill,
} from "./chart-theme";
import { RangeTabs } from "./range-tabs";
import { useReducedMotion } from "@/lib/use-reduced-motion";

const RANGES = [
  { key: "week", label: "Past week" },
  { key: "month", label: "Past month" },
  { key: "all", label: "All time" },
] as const;

type Range = (typeof RANGES)[number]["key"];

// "Past week" needs daily granularity (a single weekly bar would be one
// data point) — SignupMetrics.dailySignups is already the trailing 7 days,
// so no extra fetch. "Past month"/"all time" stay weekly-bucketed.
const MONTH_WEEKS = 4;

function shortWeekLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function shortDayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
}

// The Overview page's big trend chart: signups over time, single series,
// rendered with a top-saturated-to-transparent gradient fill. A range
// toggle swaps between daily (past week) and weekly (past month / all
// time) buckets rather than just windowing the same series.
export function OverviewTrendChart({
  weekly,
  daily,
}: {
  weekly: WeeklySignupBucket[];
  daily: DailySignupBucket[];
}) {
  const reducedMotion = useReducedMotion();
  const [range, setRange] = useState<Range>("month");

  const rows =
    range === "week"
      ? daily.map((d) => ({ label: shortDayLabel(d.date), value: d.count }))
      : (range === "month" ? weekly.slice(-MONTH_WEEKS) : weekly).map((w) => ({
          label: shortWeekLabel(w.weekStart),
          value: w.total,
        }));

  if (rows.length === 0) return null;

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <RangeTabs options={RANGES} active={range} onChange={setRange} />
      </div>
      <ResponsiveContainer width="100%" height={244}>
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
            dataKey="value"
            fill="url(#overviewTrendFill)"
            radius={[6, 6, 0, 0]}
            maxBarSize={36}
            isAnimationActive={!reducedMotion}
            animationBegin={150}
            animationDuration={600}
            animationEasing="ease-out"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
