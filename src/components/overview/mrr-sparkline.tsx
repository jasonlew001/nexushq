// Inline SVG area+line — no charting library. `colorVar` picks which CSS
// custom property to stroke/fill with (e.g. "--accent" or "--gold") so one
// component serves every KPI card. Returns null rather than a fabricated
// line when there aren't enough points to be meaningful.
export function Sparkline({ points, colorVar = "--accent" }: { points: number[]; colorVar?: string }) {
  if (points.length < 2) return null;

  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1; // flat series: avoid divide-by-zero

  const w = 200;
  const h = 40;
  const pad = 2;
  const stepX = (w - pad * 2) / (points.length - 1);

  const coords = points.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (h - pad * 2) * (1 - (v - min) / range);
    return [x, y] as const;
  });

  const linePath = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${coords[coords.length - 1][0].toFixed(1)},${h - pad} L${coords[0][0].toFixed(1)},${h - pad} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-10 w-full" preserveAspectRatio="none" aria-hidden>
      <path d={areaPath} fill={`hsl(var(${colorVar}) / 0.15)`} />
      <path
        d={linePath}
        fill="none"
        stroke={`hsl(var(${colorVar}))`}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
