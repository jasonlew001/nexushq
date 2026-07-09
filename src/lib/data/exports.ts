import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase-server";

// user_id -> exported_at for everyone who has appeared in a customer CSV
// export. Founder-session read (RLS founder-only on hq_customer_exports).
export const getExportedUsers = cache(async (): Promise<Map<string, string>> => {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hq_customer_exports")
    .select("user_id, exported_at");

  if (error) {
    throw new Error(`Failed to load hq_customer_exports: ${error.message}`);
  }

  return new Map(
    ((data ?? []) as unknown as { user_id: string; exported_at: string }[]).map((r) => [
      r.user_id,
      r.exported_at,
    ])
  );
});
