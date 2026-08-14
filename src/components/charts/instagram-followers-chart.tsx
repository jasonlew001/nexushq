"use client";

import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { CHART_GRID, CHART_TEXT_MUTED, CHART_ACCENT, CHART_GOLD, CHART_SURFACE, tooltipContentStyle, tooltipLabelStyle, tooltipItemStyle } from "./chart-theme";
import { RangeTabs } from "./range-tabs";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { cn } from "@/lib/cn";
import type { DailyMetricPoint } from "@/lib/instagram";

const RANGES = [
  { key: "30", label: "30d" },
  { key: "90", label: "90d" },
  { key: "365", label: "1y" },
] as const;

const METRICS = [
  { key: "followers", label: "Followers" },
  { key: "reach", label: "Reach" },
] as const;

function shortDateLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// Real history from Instagram's insights time_series (up to 2 years) — see
// src/lib/data/instagram-metrics.ts for how followerHistory is reconstructed
// from daily deltas (Meta doesn't expose cumulative follower totals
// directly). A metric toggle switches the same chart between followers and
// reach rather than rendering two separate charts.
export function InstagramFollowersChart({
  followerHistory,
  reachHistory,
}: {
  followerHistory: DailyMetricPoint[];
  reachHistory: DailyMetricPoint[];
}) {
  const [metric, setMetric] = useState<(typeof METRICS)[number]["key"]>("followers");
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("90");
  const reducedMotion = useReducedMotion();

  const source = metric === "followers" ? followerHistory : reachHistory;
  const color = metric === "followers" ? CHART_ACCENT : CHART_GOLD;

  const rows = useMemo(
    () => source.slice(-Number(range)).map((p) => ({ label: shortDateLabel(p.date), value: p.value })),
    [source, range]
  );

  if (source.length < 2) {
    return (
      <p className="text-xs text-faint">
        Building history — Instagram's insights data only starts accumulating from when the account began
        posting; check back as more days come in.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          {METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMetric(m.key)}
              className={cn(
                "whitespace-nowrap rounded-md px-2.5 py-1 text-xs transition-colors",
                metric === m.key ? "bg-accent/10 text-accent" : "text-faint hover:text-muted"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
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
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={tooltipContentStyle}
            labelStyle={tooltipLabelStyle}
            itemStyle={tooltipItemStyle}
            formatter={(value) => [Number(value).toLocaleString(), metric === "followers" ? "Followers" : "Reach"]}
            cursor={{ stroke: CHART_GRID, strokeWidth: 1 }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5, fill: color, stroke: CHART_SURFACE, strokeWidth: 2 }}
            isAnimationActive={!reducedMotion}
            animationBegin={150}
            animationDuration={600}
            animationEasing="ease-out"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
