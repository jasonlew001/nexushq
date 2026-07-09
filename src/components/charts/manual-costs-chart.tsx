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
import {
  CHART_GRID,
  CHART_TEXT_MUTED,
  CHART_SURFACE,
  CATEGORICAL,
  tooltipContentStyle,
  tooltipLabelStyle,
  tooltipItemStyle,
} from "./chart-theme";
import { ToggleChips } from "./toggle-chips";
import { RangeTabs } from "./range-tabs";
import { formatCentsPrecise } from "@/lib/format";

export interface ManualCostsMonthRow {
  month: string; // YYYY-MM
  byService: Record<string, number>; // cents
}

const RANGES = [
  { key: "3", label: "3m" },
  { key: "6", label: "6m" },
  { key: "12", label: "12m" },
] as const;

function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
}

// Stacked monthly manual costs, one segment per service, plus a
// current-month totals list. `services` arrives pre-ordered (by total,
// desc) from the server so colors stay stable across range changes.
export function ManualCostsChart({
  rows,
  services,
}: {
  rows: ManualCostsMonthRow[];
  services: string[];
}) {
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("6");
  const [active, setActive] = useState<Set<string>>(() => new Set(services));

  const colorFor = (service: string) =>
    CATEGORICAL[services.indexOf(service) % CATEGORICAL.length] ?? CATEGORICAL[0];

  function toggle(service: string) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(service)) next.delete(service);
      else next.add(service);
      return next.size === 0 ? new Set(services) : next;
    });
  }

  const visibleServices = services.filter((s) => active.has(s));
  const lastVisible = visibleServices.at(-1);

  const chartRows = useMemo(() => {
    const sliced = rows.slice(-Number(range));
    return sliced.map((r) => {
      const row: Record<string, number | string> = { label: monthLabel(r.month) };
      for (const s of services) {
        row[s] = (r.byService[s] ?? 0) / 100;
      }
      return row;
    });
  }, [rows, range, services]);

  // Current-month totals for the side list (last row = current month).
  const current = rows.at(-1)?.byService ?? {};
  const currentTotal = visibleServices.reduce((sum, s) => sum + (current[s] ?? 0), 0);

  if (services.length === 0) {
    return <p className="text-xs text-faint">No manual costs entered yet.</p>;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <ToggleChips
          options={services.map((s) => ({ key: s, label: s, color: colorFor(s) }))}
          active={active}
          onToggle={toggle}
        />
        <RangeTabs options={RANGES} active={range} onChange={setRange} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartRows} barCategoryGap="20%">
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
              formatter={(value, name) => [
                `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
                String(name),
              ]}
              cursor={{ fill: "rgba(255,255,255,0.03)" }}
            />
            {visibleServices.map((service) => (
              <Bar
                key={service}
                dataKey={service}
                stackId="manual"
                fill={colorFor(service)}
                stroke={CHART_SURFACE}
                strokeWidth={2}
                maxBarSize={28}
                radius={service === lastVisible ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>

        <div className="space-y-1.5 self-center">
          <p className="font-mono text-[10px] uppercase tracking-wider text-faint">
            This month (monthly-equiv.)
          </p>
          {visibleServices.map((service) => (
            <div key={service} className="flex items-center justify-between gap-3 text-xs">
              <span className="flex min-w-0 items-center gap-1.5 text-muted">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: colorFor(service) }}
                />
                <span className="truncate">{service}</span>
              </span>
              <span className="tnum font-mono">{formatCentsPrecise(current[service] ?? 0)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-edge pt-1.5 text-xs">
            <span className="font-mono uppercase tracking-wider text-muted">Total</span>
            <span className="tnum font-mono text-gold">{formatCentsPrecise(currentTotal)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
