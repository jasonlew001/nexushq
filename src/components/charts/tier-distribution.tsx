"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from "recharts";
import { CHART_GRID, CHART_TEXT_MUTED, CHART_ACCENT, CATEGORICAL, tooltipContentStyle, tooltipLabelStyle, tooltipItemStyle } from "./chart-theme";
import { EmptyState } from "@/components/ui/empty-state";

// Two fixed categories — each bar's own axis label already carries
// identity, so distinct hues (not the null-data gray, which is reserved
// for "no attribution") read clean without a legend box.
export function TierDistributionChart({ free, premium }: { free: number; premium: number }) {
  if (free === 0 && premium === 0) {
    return <EmptyState label="No customer data yet" />;
  }

  const rows = [
    { tier: "Free", count: free, color: CATEGORICAL[0] },
    { tier: "Premium", count: premium, color: CHART_ACCENT },
  ];

  return (
    <ResponsiveContainer width="100%" height={200}>
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
          dataKey="tier"
          tick={{ fill: CHART_TEXT_MUTED, fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={64}
        />
        <Tooltip
          contentStyle={tooltipContentStyle}
          labelStyle={tooltipLabelStyle}
          itemStyle={tooltipItemStyle}
          formatter={(value) => [value, "Customers"]}
          cursor={{ fill: "rgba(255,255,255,0.03)" }}
        />
        <Bar dataKey="count" maxBarSize={28} radius={[0, 4, 4, 0]}>
          {rows.map((row) => (
            <Cell key={row.tier} fill={row.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
