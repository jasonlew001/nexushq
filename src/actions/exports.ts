"use server";

import { revalidatePath } from "next/cache";
import { requireFounder } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";

// Called right after the browser downloads a customer CSV — records who was
// included so future exports can filter to never-exported people.
// Re-exporting someone bumps their exported_at.
export async function markExported(userIds: string[]): Promise<void> {
  const founder = await requireFounder();

  if (userIds.length === 0) return;
  if (userIds.length > 10_000) throw new Error("Too many rows in one export");

  const supabase = createSupabaseServerClient();
  const rows = userIds.map((user_id) => ({
    user_id,
    exported_at: new Date().toISOString(),
    exported_by: founder.userId,
  }));

  const { error } = await supabase
    .from("hq_customer_exports")
    .upsert(rows, { onConflict: "user_id" });

  if (error) throw new Error(`Failed to record export: ${error.message}`);
  revalidatePath("/customers");
}
