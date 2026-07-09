// Edit here — no UI for these yet, per spec ("hardcoded number I can edit
// later, no fancy forecasting").
export const ANTHROPIC_MONTHLY_SPEND_ALERT_USD = 500;

// Attribution columns are NULL for everyone who signed up before this date
// (Part A shipped 2026-07-05). Never treat that as broken data.
export const TRACKING_START_DATE = "2026-07-05";

// The main site's AI-recommendations key currently ships to the browser
// (NEXT_PUBLIC_CLAUDE_API_KEY, slated for rotation) — historical Anthropic
// usage before rotation may include abuse traffic from that exposure.
export const ANTHROPIC_KEY_ROTATION_CAVEAT =
  "Usage before the main site's Claude key rotation may include abuse traffic (the key was exposed client-side).";

// Canceling/expiring-soon window for the action strip.
export const CANCELING_SOON_WINDOW_DAYS = 14;

// Widest window the weekly charts can show (range tabs slice client-side:
// 4/12/26 weeks) — the data layer always computes the full window.
export const CHART_WEEKS = 26;

// System-strip staleness threshold — a dataset's oldest-update dot turns
// amber past this many days. Edit here, no UI for it yet.
export const DATA_STALENESS_WARN_DAYS = 30;

// Widest window the monthly cost/revenue charts can show (range tabs slice
// client-side: 3/6/12 months) and the Anthropic cost fetch window that
// feeds them. Current partial month included.
export const COST_HISTORY_MONTHS = 12;

// Shared bucket keys for attribution charts — kept here (not in
// lib/data/signups.ts) because chart-theme.ts is imported by client
// components, and lib/data/* pulls in server-only Supabase code.
export const UNATTRIBUTED = "unattributed";
export const OTHER_SOURCE = "other";
export const NO_ACQ_DATA = "no_data";

// Manual-cost allocation — client-safe home for the same reason as above
// (the cost entry form is a client component).
export const PEOPLE = ["nick", "jason", "kamp"] as const;
export type Person = (typeof PEOPLE)[number];
export const UNASSIGNED = "unassigned";
