// Hand-written types for the subset of columns HQ actually reads — no
// generated-types codegen step (would be a new dev dependency/workflow).
// Schema verified against fairway-mvp's add-attribution-columns.sql /
// add-stripe-columns.sql; re-verify with information_schema if this drifts.

export type SubscriptionStatus =
  | "active"
  | "canceled"
  | "past_due"
  | "trialing"
  | null;

export type SubscriptionTier = "free" | "premium";

export type AcqSource =
  | "coach_referral"
  | "instagram"
  | "google_search"
  | "friend_teammate"
  | "tournament"
  | "other"
  | null;

export interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  city_state: string | null;
  phone: string | null;
  graduation_year: number | null;
  gender: string | null;
  updated_at: string | null;

  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: SubscriptionStatus;
  subscription_renews_at: string | null;
  subscription_tier: SubscriptionTier | null;

  acq_source: AcqSource;
  acq_source_detail: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  first_referrer: string | null;
  landing_page: string | null;

  is_founder: boolean;
}

export interface AuthUser {
  id: string;
  email: string | null;
  created_at: string;
}

// Flattened, fully-serializable row for the customer table / detail panel.
// lifetimeRevenueCents is null until the Stripe layer decorates it.
export interface CustomerRow {
  id: string;
  name: string;
  email: string | null;
  cityState: string | null;
  state: string | null;
  signedUpAt: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  acqSource: AcqSource;
  acqSourceDetail: string | null;
  tier: SubscriptionTier | null;
  status: SubscriptionStatus;
  stripeCustomerId: string | null;
  lifetimeRevenueCents: number | null;
  isPreTracking: boolean;
}

export interface CachedResult<T> {
  data: T;
  fetchedAt: string;
}
