import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { Profile } from "@/lib/types";

const PAGE_SIZE = 1000;

// All user_profiles rows, via the founder session (RLS `founders_read_all`
// grants this once is_founder() is true — no service role needed). Not
// unstable_cache-able (createSupabaseServerClient reads cookies()); React
// cache() dedupes it to one fetch-loop per request instead.
export const getAllProfiles = cache(async (): Promise<Profile[]> => {
  const supabase = createSupabaseServerClient();
  const rows: Profile[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .from("user_profiles")
      .select(
        "id, first_name, last_name, city_state, phone, graduation_year, gender, updated_at, " +
          "stripe_customer_id, stripe_subscription_id, subscription_status, subscription_renews_at, subscription_tier, " +
          "acq_source, acq_source_detail, utm_source, utm_medium, utm_campaign, first_referrer, landing_page, is_founder"
      )
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to load user_profiles: ${error.message}`);
    }

    rows.push(...((data ?? []) as unknown as Profile[]));

    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
});

export const getProfileById = cache(async (id: string): Promise<Profile | null> => {
  const profiles = await getAllProfiles();
  return profiles.find((p) => p.id === id) ?? null;
});
