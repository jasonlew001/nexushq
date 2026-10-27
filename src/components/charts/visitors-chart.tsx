"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { TrafficDay } from "@/lib/data/vercel-metrics";
import {
  CHART_GRID,
  CHART_TEXT_MUTED,
  CHART_ACCENT,
  tooltipContentStyle,
  tooltipLabelStyle,
  tooltipItemStyle,
  tooltipCursorFill,
} from "./chart-theme";
import { useReducedMotion } from "@/lib/use-reduced-motion";

function dayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function VisitorsTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: TrafficDay & { label: string } }[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={tooltipContentStyle}>
      <p style={tooltipLabelStyle}>{d.label}</p>
      <p style={tooltipItemStyle}>{d.visitors.toLocaleString()} visitors</p>
      <p style={{ ...tooltipItemStyle, color: CHART_TEXT_MUTED }}>{d.pageviews.toLocaleString()} pageviews</p>
    </div>
  );
}

// Daily unique visitors, trailing 30 days. Single series, so no legend:
// the panel title names it. Pageviews ride along in the tooltip only (a
// second bar would need its own scale — one axis, one measure).
export function VisitorsChart({ daily }: { daily: TrafficDay[] }) {
  const reducedMotion = useReducedMotion();
  if (daily.length === 0) return null;

  const rows = daily.map((d) => ({ ...d, label: dayLabel(d.date) }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={rows} barCategoryGap={2} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={CHART_GRID} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: CHART_TEXT_MUTED, fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: CHART_GRID }}
          interval="preserveStartEnd"
          minTickGap={48}
        />
        <YAxis
          tick={{ fill: CHART_TEXT_MUTED, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={36}
          allowDecimals={false}
        />
        <Tooltip content={<VisitorsTooltip />} cursor={tooltipCursorFill} />
        <Bar
          dataKey="visitors"
          fill={CHART_ACCENT}
          radius={[3, 3, 0, 0]}
          maxBarSize={16}
          isAnimationActive={!reducedMotion}
          animationDuration={500}
          animationEasing="ease-out"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
