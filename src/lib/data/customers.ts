import { cache } from "react";
import { getAllProfiles } from "./profiles";
import { getAllAuthUsers } from "./users";
import { parseState } from "@/lib/format";
import { TRACKING_START_DATE } from "@/lib/constants";
import type { CustomerRow } from "@/lib/types";

function fullName(first: string | null, last: string | null): string {
  const name = [first, last].filter(Boolean).join(" ").trim();
  return name || "—";
}

// Join user_profiles x auth.users into the flat, serializable shape the
// customer table and KPI/chart aggregations all read from.
// lifetimeRevenueCents is null here — the Stripe layer (Phase 5) decorates
// it via attachLifetimeRevenue() before this reaches the customer table.
export const getCustomerRows = cache(async (): Promise<CustomerRow[]> => {
  const [profiles, { data: authUsers }] = await Promise.all([
    getAllProfiles(),
    getAllAuthUsers(),
  ]);

  const authById = new Map(authUsers.map((u) => [u.id, u]));
  const trackingStart = new Date(TRACKING_START_DATE).getTime();

  return profiles.map((p): CustomerRow => {
    const authUser = authById.get(p.id);
    const signedUpAt = authUser?.created_at ?? p.updated_at ?? new Date(0).toISOString();
    const hasNoAttribution =
      !p.utm_source && !p.utm_medium && !p.utm_campaign && !p.acq_source && !p.first_referrer;

    return {
      id: p.id,
      name: fullName(p.first_name, p.last_name),
      email: authUser?.email ?? null,
      cityState: p.city_state,
      state: parseState(p.city_state),
      signedUpAt,
      utmSource: p.utm_source,
      utmMedium: p.utm_medium,
      utmCampaign: p.utm_campaign,
      acqSource: p.acq_source,
      acqSourceDetail: p.acq_source_detail,
      tier: p.subscription_tier,
      status: p.subscription_status,
      stripeCustomerId: p.stripe_customer_id,
      lifetimeRevenueCents: null,
      isPreTracking: new Date(signedUpAt).getTime() < trackingStart && hasNoAttribution,
    };
  });
});

export function attachLifetimeRevenue(
  rows: CustomerRow[],
  revenueByCustomerId: Map<string, number>
): CustomerRow[] {
  return rows.map((row) =>
    row.stripeCustomerId && revenueByCustomerId.has(row.stripeCustomerId)
      ? { ...row, lifetimeRevenueCents: revenueByCustomerId.get(row.stripeCustomerId)! }
      : row
  );
}
