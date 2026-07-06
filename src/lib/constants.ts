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

// How many trailing weeks the signups/MRR-over-time charts cover.
export const CHART_WEEKS = 12;

// Shared bucket keys for attribution charts — kept here (not in
// lib/data/signups.ts) because chart-theme.ts is imported by client
// components, and lib/data/* pulls in server-only Supabase code.
export const UNATTRIBUTED = "unattributed";
export const OTHER_SOURCE = "other";
export const NO_ACQ_DATA = "no_data";
