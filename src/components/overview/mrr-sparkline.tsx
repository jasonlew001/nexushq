// Inline SVG area+line — no charting library. Renders the real weekly MRR
// series (lib/data/stripe-metrics.ts → mrrOverTime); returns null rather
// than a fabricated line when there aren't enough points to be meaningful.
export function MrrSparkline({ series }: { series: { weekStart: string; mrrCents: number }[] }) {
  if (series.length < 2) return null;

  const values = series.map((s) => s.mrrCents);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1; // flat series: avoid divide-by-zero

  const w = 200;
  const h = 40;
  const pad = 2;
  const stepX = (w - pad * 2) / (values.length - 1);

  const points = values.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (h - pad * 2) * (1 - (v - min) / range);
    return [x, y] as const;
  });

  const linePath = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1][0].toFixed(1)},${h - pad} L${points[0][0].toFixed(1)},${h - pad} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-10 w-full" preserveAspectRatio="none" aria-hidden>
      <path d={areaPath} fill="hsl(var(--gold) / 0.15)" />
      <path
        d={linePath}
        fill="none"
        stroke="hsl(var(--gold))"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
