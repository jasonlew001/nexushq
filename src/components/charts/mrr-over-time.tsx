"use client";

import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { CHART_GRID, CHART_TEXT_MUTED, CHART_ACCENT, CHART_SURFACE, tooltipContentStyle, tooltipLabelStyle, tooltipItemStyle } from "./chart-theme";
import { RangeTabs } from "./range-tabs";
import { formatCentsWhole } from "@/lib/format";

const RANGES = [
  { key: "4", label: "4w" },
  { key: "12", label: "12w" },
  { key: "26", label: "26w" },
] as const;

function shortWeekLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function MrrOverTimeChart({
  data,
}: {
  data: { weekStart: string; mrrCents: number }[];
}) {
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("12");

  const rows = useMemo(
    () =>
      data
        .slice(-Number(range))
        .map((d) => ({ label: shortWeekLabel(d.weekStart), mrr: d.mrrCents / 100 })),
    [data, range]
  );

  if (data.length === 0) return null;

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <RangeTabs options={RANGES} active={range} onChange={setRange} />
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
            width={48}
            tickFormatter={(v: number) => `$${v.toLocaleString()}`}
          />
          <Tooltip
            contentStyle={tooltipContentStyle}
            labelStyle={tooltipLabelStyle}
            itemStyle={tooltipItemStyle}
            formatter={(value) => [formatCentsWhole(Number(value) * 100), "MRR"]}
            cursor={{ stroke: CHART_GRID, strokeWidth: 1 }}
          />
          <Line
            type="monotone"
            dataKey="mrr"
            stroke={CHART_ACCENT}
            strokeWidth={2}
            dot={{ r: 3, fill: CHART_ACCENT, stroke: CHART_SURFACE, strokeWidth: 2 }}
            activeDot={{ r: 5, fill: CHART_ACCENT, stroke: CHART_SURFACE, strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
