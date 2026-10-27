"use client";

import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { DeployRow } from "@/lib/data/vercel-metrics";
import { CHART_GRID, CHART_TEXT_MUTED, CHART_ACCENT, tooltipContentStyle, tooltipCursorFill } from "./chart-theme";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { formatDuration } from "@/lib/format";

// Status colors, not categorical: green = shipped, red = build failed,
// amber = blocked/canceled (never built), gray = still building. Every
// state is also named in the legend and the tooltip, never color alone.
const STATE_STYLE: Record<string, { fill: string; label: string }> = {
  READY: { fill: CHART_ACCENT, label: "Shipped" },
  ERROR: { fill: "#BE2F35", label: "Build failed" },
  BLOCKED: { fill: "#B85F0A", label: "Blocked" },
  CANCELED: { fill: "#B85F0A", label: "Canceled" },
};
const PENDING_STYLE = { fill: "#989DA6", label: "Building" };

function styleFor(state: string) {
  return STATE_STYLE[state] ?? PENDING_STYLE;
}

interface Point {
  key: string;
  label: string;
  // Failed/blocked deploys have no build time; they render as a short
  // fixed stub so they stay visible in the sequence.
  value: number;
  row: DeployRow;
}

function DeployTooltip({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  if (!active || !payload?.length) return null;
  const { row } = payload[0].payload;
  const style = styleFor(row.state);
  return (
    <div style={{ ...tooltipContentStyle, maxWidth: 280 }}>
      <p className="mb-1 flex items-center gap-1.5 text-[11px] text-muted">
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: style.fill }} />
        {style.label}
        {row.isLive ? " · live now" : ""}
        <span className="text-faint">
          {" · "}
          {new Date(row.createdAt).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
      </p>
      <p className="line-clamp-2 text-xs font-medium text-ink">{row.message ?? "No commit message"}</p>
      <p className="mt-1 font-mono text-[11px] text-muted">
        {row.sha ?? "manual"}
        {row.buildSeconds != null ? ` · built in ${formatDuration(row.buildSeconds)}` : ""}
      </p>
      {row.errorMessage && <p className="mt-1 line-clamp-3 text-[11px] text-danger">{row.errorMessage}</p>}
    </div>
  );
}

export function DeployHistoryChart({ history }: { history: DeployRow[] }) {
  const reducedMotion = useReducedMotion();
  const builds = history.flatMap((r) => (r.buildSeconds != null ? [r.buildSeconds] : []));
  const stub = Math.max(20, Math.round((builds.length ? Math.max(...builds) : 120) * 0.12));

  const points: Point[] = history
    .slice()
    .reverse()
    .map((row) => ({
      key: row.id,
      label: new Date(row.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: row.buildSeconds ?? stub,
      row,
    }));

  if (points.length === 0) return null;

  const statesPresent = new Set(history.map((r) => styleFor(r.state).label));
  const legend = [...Object.values(STATE_STYLE), PENDING_STYLE].filter(
    (s, i, all) => statesPresent.has(s.label) && all.findIndex((o) => o.label === s.label) === i
  );

  return (
    <div>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={points} barCategoryGap={2} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={CHART_GRID} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: CHART_TEXT_MUTED, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: CHART_GRID }}
            interval="preserveStartEnd"
            minTickGap={40}
          />
          <YAxis
            tick={{ fill: CHART_TEXT_MUTED, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={36}
            tickFormatter={(s: number) => `${Math.round(s / 60)}m`}
            allowDecimals={false}
          />
          <Tooltip content={<DeployTooltip />} cursor={tooltipCursorFill} />
          <Bar
            dataKey="value"
            radius={[3, 3, 0, 0]}
            maxBarSize={14}
            isAnimationActive={!reducedMotion}
            animationDuration={500}
            animationEasing="ease-out"
          >
            {points.map((p) => (
              <Cell
                key={p.key}
                fill={styleFor(p.row.state).fill}
                fillOpacity={p.row.state === "READY" && !p.row.isLive ? 0.55 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
        <span className="text-faint">Build time per production deploy, oldest → newest</span>
        {legend.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: s.fill }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
