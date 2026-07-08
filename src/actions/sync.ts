"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireFounder } from "@/lib/auth";

// Force-refresh every unstable_cache'd external source (Stripe, Anthropic,
// Supabase auth users). The tags match the ones declared at each cache site;
// revalidatePath covers the route-level cache so the response that follows
// this action re-renders with fresh data.
export async function syncNow(): Promise<void> {
  await requireFounder();

  revalidateTag("hq-users");
  revalidateTag("hq-stripe");
  revalidateTag("hq-stripe-revenue");
  revalidateTag("hq-anthropic");
  revalidatePath("/", "layout");
}
