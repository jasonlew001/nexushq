"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from "recharts";
import { CHART_GRID, CHART_TEXT_MUTED, CHART_ACCENT, NULL_GRAY, tooltipContentStyle, tooltipLabelStyle } from "./chart-theme";
import { EmptyState } from "@/components/ui/empty-state";
import type { StateBucket } from "@/lib/data/signups";

const TOP_STATES_CAP = 15;
const UNKNOWN_KEY = "Unknown";

// Magnitude comparison across states, not identity — one hue (accent),
// never a rainbow per state. "Unknown" (unparsed city_state) always renders
// in the same muted gray as every other no-attribution bucket.
export function SignupsByStateChart({
  data,
  unknownCount,
}: {
  data: StateBucket[];
  unknownCount: number;
}) {
  if (data.length === 0 && unknownCount === 0) {
    return <EmptyState label="No signups yet" />;
  }

  const top = data.slice(0, TOP_STATES_CAP);
  const rest = data.slice(TOP_STATES_CAP);
  const otherCount = rest.reduce((sum, s) => sum + s.count, 0);

  const rows: { state: string; count: number }[] = top.map((s) => ({
    state: s.state,
    count: s.count,
  }));
  if (otherCount > 0) rows.push({ state: "Other", count: otherCount });
  if (unknownCount > 0) rows.push({ state: UNKNOWN_KEY, count: unknownCount });

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={rows} barCategoryGap="15%">
        <CartesianGrid stroke={CHART_GRID} strokeDasharray="0" vertical={false} />
        <XAxis
          dataKey="state"
          tick={{ fill: CHART_TEXT_MUTED, fontSize: 10 }}
          tickLine={false}
          axisLine={{ stroke: CHART_GRID }}
          interval={0}
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
          formatter={(value) => [value, "Signups"]}
          cursor={{ fill: "rgba(255,255,255,0.03)" }}
        />
        <Bar dataKey="count" maxBarSize={24} radius={[4, 4, 0, 0]}>
          {rows.map((row) => (
            <Cell key={row.state} fill={row.state === UNKNOWN_KEY ? NULL_GRAY : CHART_ACCENT} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
