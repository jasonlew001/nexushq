const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const usdCents = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export function formatCentsWhole(cents: number): string {
  return usd.format(cents / 100);
}

export function formatCentsPrecise(cents: number): string {
  return usdCents.format(cents / 100);
}

export function formatPercent(fraction: number, digits = 1): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
}

// Free-text "City, ST" (or "City, State", or just "ST") -> two-letter state
// code. Expect messy/NULL input — this is a best-effort parse, not a
// validator; returns null rather than guessing.
const STATE_ABBREVIATIONS = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID",
  "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS",
  "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK",
  "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV",
  "WI", "WY", "DC",
]);

export function parseState(cityState: string | null): string | null {
  if (!cityState || !cityState.trim()) return null;

  const parts = cityState.split(",").map((p) => p.trim()).filter(Boolean);
  const candidate = (parts.at(-1) ?? cityState.trim()).toUpperCase();

  // Strip a trailing US zip if someone typed "City, ST 12345".
  const withoutZip = candidate.replace(/\s*\d{5}(-\d{4})?$/, "").trim();

  if (STATE_ABBREVIATIONS.has(withoutZip)) return withoutZip;

  // Try the first two letters as a last resort (e.g. "California" typed in full
  // won't match — deliberately not guessing full state names to avoid false
  // positives on free text).
  return null;
}

// Monday-start UTC week boundary, as an ISO date string (the week's key).
export function startOfWeekUTC(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function weeksAgoUTC(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n * 7);
  return d;
}
