import { cache } from "react";
import { redirect, notFound } from "next/navigation";
import { createSupabaseServerClient } from "./supabase-server";

if (typeof window !== "undefined") {
  throw new Error("auth.ts must never be imported client-side");
}

export type FoundersSession = {
  userId: string;
  email: string | undefined;
};

// The gate. cache() dedupes this to one auth round-trip per request no
// matter how many server components call it. No session -> /login
// (founders need a way in). Authenticated but not a founder -> a real 404,
// not a redirect — non-founders get zero hint an admin app exists.
export const requireFounder = cache(async (): Promise<FoundersSession> => {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: isFounder, error } = await supabase.rpc("is_founder");

  if (error || !isFounder) {
    notFound();
  }

  return { userId: user.id, email: user.email };
});
