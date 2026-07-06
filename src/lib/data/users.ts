import { unstable_cache } from "next/cache";
import { getAdminClient } from "@/lib/supabase-server";
import type { AuthUser, CachedResult } from "@/lib/types";

const PAGE_SIZE = 1000;

// auth.users is not session-scoped RLS data — safe to share this cache
// between both founders. This is the only place emails and the true
// signup timestamp (auth.users.created_at — user_profiles has none) live.
async function fetchAllAuthUsers(): Promise<CachedResult<AuthUser[]>> {
  const admin = getAdminClient();
  const users: AuthUser[] = [];
  let page = 1;

  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error) {
      throw new Error(`Failed to list auth.users: ${error.message}`);
    }

    for (const u of data.users) {
      users.push({ id: u.id, email: u.email ?? null, created_at: u.created_at });
    }

    if (data.users.length < PAGE_SIZE) break;
    page += 1;
  }

  return { data: users, fetchedAt: new Date().toISOString() };
}

export const getAllAuthUsers = unstable_cache(fetchAllAuthUsers, ["hq-users"], {
  revalidate: 300,
  tags: ["hq-users"],
});
