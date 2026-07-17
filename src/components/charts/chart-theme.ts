import { UNATTRIBUTED, OTHER_SOURCE, NO_ACQ_DATA } from "@/lib/constants";

// Validated against the app's light chart surface (#FFFFFF) — see dataviz
// skill's documented reference instance (references/palette.md), whose
// eight hues match this app's prior dark-mode set re-stepped and re-ordered
// for light. Re-verified directly against our surface:
// node scripts/validate_palette.js "#2a78d6,#008300,#e87ba4,#eda100,#1baf7a,#eb6834,#4a3aa7,#e34948"
//   --mode light --surface "#ffffff"
// -> ALL CHECKS PASS (lightness/chroma/CVD/normal-vision floor); 3 slots
//    (magenta, yellow, aqua) sit below 3:1 contrast by design — the
//    documented "relief rule" applies (visible tooltips/legends/chips, both
//    already in use on every chart here, not color alone).
// Order is the CVD-safety mechanism: assign in this fixed sequence, never
// cycle or re-sort by value.
export const CATEGORICAL = [
  "#2a78d6", // blue
  "#008300", // green
  "#e87ba4", // magenta
  "#eda100", // yellow
  "#1baf7a", // aqua
  "#eb6834", // orange
  "#4a3aa7", // violet
  "#e34948", // red
] as const;

// One consistent gray for every "no attribution" / "unattributed" / "no
// data" bucket, across every chart — never a categorical hue.
export const NULL_GRAY = "#8A929C";

export const CHART_SURFACE = "#FFFFFF";
export const CHART_GRID = "#E7E9EC"; // one step off surface, hairline
export const CHART_TEXT_MUTED = "#5D6570";
export const CHART_TEXT_INK = "#1A202B";
export const CHART_ACCENT = "#257F5C"; // matches --accent
export const CHART_GOLD = "#93701F"; // matches --gold, MRR/money only

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
  background: "#FFFFFF",
  border: "1px solid #DDE0E5",
  borderRadius: 8,
  boxShadow: "0 4px 12px rgba(16,24,40,0.08)",
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
// falls back to #000 when it doesn't (e.g. bars filled via <Cell>). Force
// ink explicitly so every item stays legible regardless of series color.
export const tooltipItemStyle: React.CSSProperties = {
  color: CHART_TEXT_INK,
};

// Shared hover-cursor tint for Bar/Composed charts — a faint ink wash,
// legible on the light surface (the old dark-mode rgba(255,255,255,…) was
// invisible here).
export const tooltipCursorFill = { fill: "rgba(16,24,40,0.04)" };
