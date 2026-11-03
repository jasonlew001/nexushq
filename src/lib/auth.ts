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
export type RepSession = {
  userId: string;
  repId: string;
};

// The rep portal's gate. Rep identity = the session's verified email
// matching an active hq_sales_reps row (current_sales_rep_id(), sql/012).
// Signed in but not an active rep -> 404, same no-hints rule as founders.
// The /rep page's gate. Signed in but not an active rep (a founder opening
// the rep link in their HQ browser, a deactivated rep) returns `notRep` so
// the page can say so with a sign-out — /rep/login bounces signed-in
// visitors to /rep, so a 404 there is a dead end.
export const getRepAccess = cache(
  async (): Promise<RepSession | { notRep: true; email: string | undefined }> => {
    const supabase = createSupabaseServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/rep/login");
    }

    const { data: repId, error } = await supabase.rpc("current_sales_rep_id");

    if (error || !repId) {
      return { notRep: true, email: user.email };
    }

    return { userId: user.id, repId: repId as string };
  }
);

export const requireRep = cache(async (): Promise<RepSession> => {
  const access = await getRepAccess();
  if ("notRep" in access) {
    notFound();
  }
  return access;
});

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
