"use client";

import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/cn";
import type { WeeklySignupBucket } from "@/lib/data/signups";
import {
  CHART_GRID,
  CHART_TEXT_MUTED,
  CHART_SURFACE,
  colorForCategory,
  utmSourceLabel,
  tooltipContentStyle,
  tooltipLabelStyle,
  tooltipItemStyle,
  tooltipCursorFill,
} from "./chart-theme";
import { ToggleChips } from "./toggle-chips";
import { RangeTabs } from "./range-tabs";
import { useReducedMotion } from "@/lib/use-reduced-motion";

type Cohort = "all" | "paying";

const RANGES = [
  { key: "4", label: "4w" },
  { key: "12", label: "12w" },
  { key: "26", label: "26w" },
] as const;

function shortWeekLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// The chips replace the old passive Legend: same identity information, but
// clickable to include/exclude a source from the stack. The cohort toggle
// swaps between all signups and currently-paying users (pre-aggregated
// server-side — see SignupMetrics.weeklyPayingOnly for semantics).
export function SignupsByWeekChart({
  data,
  payingData,
  topUtmSources,
}: {
  data: WeeklySignupBucket[];
  /** Same buckets restricted to currently-paying users; enables the cohort toggle. */
  payingData?: WeeklySignupBucket[];
  topUtmSources: string[];
}) {
  const [cohort, setCohort] = useState<Cohort>("all");
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("12");
  const reducedMotion = useReducedMotion();

  // Series present in EITHER cohort, so chip state survives switching (a
  // source with zero paying signups keeps its chip rather than vanishing).
  const allSeriesKeys = useMemo(() => {
    const candidates = [...topUtmSources, "other", "unattributed"];
    return candidates.filter(
      (key) =>
        data.some((w) => w.byUtmSource[key] > 0) ||
        (payingData ?? []).some((w) => w.byUtmSource[key] > 0)
    );
  }, [data, payingData, topUtmSources]);

  const [activeSeries, setActiveSeries] = useState<Set<string>>(() => new Set(allSeriesKeys));

  function toggleSeries(key: string) {
    setActiveSeries((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next.size === 0 ? new Set(allSeriesKeys) : next;
    });
  }

  if (data.length === 0) return null;

  const activeData = cohort === "paying" && payingData ? payingData : data;
  const visibleKeys = allSeriesKeys.filter((key) => activeSeries.has(key));
  const lastVisibleKey = visibleKeys.at(-1);

  const rows = activeData.slice(-Number(range)).map((week) => ({
    weekStart: week.weekStart,
    label: shortWeekLabel(week.weekStart),
    ...week.byUtmSource,
  }));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <ToggleChips
          options={allSeriesKeys.map((key) => ({
            key,
            label: utmSourceLabel(key),
            color: colorForCategory(key, topUtmSources),
          }))}
          active={activeSeries}
          onToggle={toggleSeries}
        />
        <div className="flex flex-wrap items-center gap-2">
          {payingData && (
            <div className="flex gap-1">
              {(["all", "paying"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCohort(c)}
                  className={cn(
                    "whitespace-nowrap rounded-md px-2.5 py-1 text-xs transition-colors",
                    cohort === c ? "bg-accent/10 text-accent" : "text-faint hover:text-muted"
                  )}
                >
                  {c === "all" ? "All signups" : "Paying only"}
                </button>
              ))}
            </div>
          )}
          <RangeTabs options={RANGES} active={range} onChange={setRange} />
        </div>
      </div>

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
            itemStyle={tooltipItemStyle}
            formatter={(value, name) => [value, utmSourceLabel(String(name))]}
            cursor={tooltipCursorFill}
          />
          {visibleKeys.map((key) => (
            <Bar
              key={key}
              dataKey={key}
              stackId="signups"
              fill={colorForCategory(key, topUtmSources)}
              stroke={CHART_SURFACE}
              strokeWidth={2}
              maxBarSize={24}
              radius={key === lastVisibleKey ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              isAnimationActive={!reducedMotion}
              animationBegin={150}
              animationDuration={600}
              animationEasing="ease-out"
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
