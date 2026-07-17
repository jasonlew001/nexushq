"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from "recharts";
import {
  CHART_GRID,
  CHART_TEXT_MUTED,
  colorForCategory,
  utmSourceLabel,
  acqSourceLabel,
  tooltipContentStyle,
  tooltipLabelStyle,
  tooltipItemStyle,
  tooltipCursorFill,
} from "./chart-theme";
import { EmptyState } from "@/components/ui/empty-state";

interface SourceBarChartProps {
  data: { source: string; count: number }[];
  order: string[]; // stable, count-ranked color assignment order
  kind: "utm" | "acq";
  emptyLabel: string;
}

// Horizontal bar list — each bar already carries its category as a Y-axis
// tick, so identity is never color-alone and no separate legend box is
// needed (a legend here would just restate the visible labels).
//
// Labeling/coloring functions live here (client-side) rather than being
// passed as props — Server Components can't pass plain functions to
// Client Components across the RSC boundary, only serializable data.
export function SourceBarChart({ data, order, kind, emptyLabel }: SourceBarChartProps) {
  if (data.length === 0) {
    return <EmptyState label={emptyLabel} />;
  }

  const labelFor = kind === "utm" ? utmSourceLabel : acqSourceLabel;
  const rows = data.map((d) => ({ ...d, label: labelFor(d.source) }));
  const height = Math.max(140, rows.length * 32);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 24 }}>
        <CartesianGrid stroke={CHART_GRID} strokeDasharray="0" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: CHART_TEXT_MUTED, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fill: CHART_TEXT_MUTED, fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={120}
        />
        <Tooltip
          contentStyle={tooltipContentStyle}
          labelStyle={tooltipLabelStyle}
          itemStyle={tooltipItemStyle}
          formatter={(value) => [value, "Signups"]}
          cursor={tooltipCursorFill}
        />
        <Bar dataKey="count" maxBarSize={20} radius={[0, 4, 4, 0]}>
          {rows.map((row) => (
            <Cell key={row.source} fill={colorForCategory(row.source, order)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
