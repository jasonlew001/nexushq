// Inline SVG line + fading area — no charting library. `colorVar` picks the
// CSS custom property to draw with (e.g. "--accent", "--brand-gold"), so one
// component serves every surface. Returns null rather than a fabricated
// line when there aren't enough points to be meaningful.
export function Sparkline({
  points,
  colorVar = "--accent",
  className = "h-10",
}: {
  points: number[];
  colorVar?: string;
  className?: string;
}) {
  if (points.length < 2) return null;

  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1; // flat series: avoid divide-by-zero

  const w = 200;
  const h = 40;
  const padTop = 4;
  const stepX = w / (points.length - 1);

  const coords = points.map((v, i) => {
    const x = i * stepX;
    const y = padTop + (h - padTop) * (1 - (v - min) / range);
    return [x, y] as const;
  });

  const linePath = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${w},${h} L0,${h} Z`;
  // Same color => same gradient, so a shared id per color var is safe even
  // when several sparklines render on one page.
  const gradientId = `spark-${colorVar.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={`${className} w-full`} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={`hsl(var(${colorVar}))`} stopOpacity="0.28" />
          <stop offset="100%" stopColor={`hsl(var(${colorVar}))`} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={`hsl(var(${colorVar}))`}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// Count series (signups per day, etc.) read better as discrete bars than a
// line. Rounded tops, 2px gaps, the latest bar at full strength.
export function MiniBars({
  points,
  colorVar = "--accent",
  className = "h-10",
}: {
  points: number[];
  colorVar?: string;
  className?: string;
}) {
  if (points.length === 0) return null;
  const max = Math.max(...points, 1);

  return (
    <div className={`${className} flex items-end gap-[3px]`} aria-hidden>
      {points.map((v, i) => (
        <span
          key={i}
          className="flex-1 rounded-t-[3px]"
          style={{
            height: `${Math.max(4, (v / max) * 100)}%`,
            background: `hsl(var(${colorVar}) / ${i === points.length - 1 ? 1 : 0.55})`,
          }}
        />
      ))}
    </div>
  );
}
