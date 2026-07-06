import { UNATTRIBUTED, OTHER_SOURCE, NO_ACQ_DATA } from "@/lib/constants";

// Validated against the app's chart surface (#111714) — see dataviz skill.
// node scripts/validate_palette.js "#3987e5,#199e70,#c98500,#008300,#9085e9,#e66767,#d55181,#d95926"
//   --mode dark --surface "#111714"
// -> all 8 slots PASS lightness/chroma/contrast; worst adjacent CVD ΔE 10.3
//    (floor band — legal with the surface-gap + legend already in use here).
// Order is the CVD-safety mechanism: assign in this fixed sequence, never
// cycle or re-sort by value.
export const CATEGORICAL = [
  "#3987e5", // blue
  "#199e70", // aqua
  "#c98500", // yellow
  "#008300", // green
  "#9085e9", // violet
  "#e66767", // red
  "#d55181", // magenta
  "#d95926", // orange
] as const;

// One consistent gray for every "no attribution" / "unattributed" / "no
// data" bucket, across every chart — never a categorical hue.
export const NULL_GRAY = "#6b7871";

export const CHART_SURFACE = "#111714";
export const CHART_GRID = "#223028"; // one step off surface, hairline
export const CHART_TEXT_MUTED = "#8FA098";
export const CHART_TEXT_INK = "#E7ECE9";
export const CHART_ACCENT = "#3DBE8B";
export const CHART_GOLD = "#D4AF37";

const ACQ_SOURCE_LABELS: Record<string, string> = {
  coach_referral: "Coach referral",
  instagram: "Instagram",
  google_search: "Google search",
  friend_teammate: "Friend / teammate",
  tournament: "Tournament",
  other: "Other",
  [NO_ACQ_DATA]: "No data",
};

export function acqSourceLabel(key: string): string {
  return ACQ_SOURCE_LABELS[key] ?? key;
}

export function utmSourceLabel(key: string): string {
  if (key === UNATTRIBUTED) return "Unattributed";
  if (key === OTHER_SOURCE) return "Other";
  return key;
}

// Assigns a stable color per category key given a fixed ordering (e.g.
// SignupMetrics.topUtmSources, or the acq_source enum order). Unattributed
// / other / no-data always render in NULL_GRAY regardless of position.
export function colorForCategory(key: string, order: readonly string[]): string {
  if (key === UNATTRIBUTED || key === OTHER_SOURCE || key === NO_ACQ_DATA) {
    return NULL_GRAY;
  }
  const index = order.indexOf(key);
  return CATEGORICAL[index % CATEGORICAL.length] ?? NULL_GRAY;
}

export const tooltipContentStyle: React.CSSProperties = {
  background: "#161D19",
  border: "1px solid #223028",
  borderRadius: 8,
  fontSize: 12,
  color: CHART_TEXT_INK,
  padding: "8px 10px",
};

export const tooltipLabelStyle: React.CSSProperties = {
  color: CHART_TEXT_MUTED,
  fontSize: 11,
  marginBottom: 4,
};

// Recharts colors tooltip items with the series color when it has one, and
// falls back to #000 when it doesn't (e.g. bars filled via <Cell>). Black on
// our dark tooltip surface is unreadable — force ink on every item.
export const tooltipItemStyle: React.CSSProperties = {
  color: CHART_TEXT_INK,
};
