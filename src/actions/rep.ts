"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRep } from "@/lib/auth";
import { createSupabaseServerClient, getAdminClient } from "@/lib/supabase-server";
import { SALES_CLAIM_KINDS, type SalesClaimKind } from "@/lib/constants";

// Rep-portal actions. Unlike actions/sales.ts these run as the REP's
// session: RLS (rep_select_own / rep_insert_own, sql/012) limits them to
// their own rows, and the insert trigger stamps created_at server-side.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(raw: string): string {
  const email = raw.trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) throw new Error("Enter a valid email");
  return email;
}

// Sends a magic link only to active reps, but answers the same either way
// so the form can't be used to discover who is a rep. The roster check uses
// the service role because the caller has no session yet (RLS would hide
// every row). shouldCreateUser: a rep's first sign-in creates their auth
// user in the shared Supabase project (agreed with Jason, 2026-11-01).
export async function sendRepLoginLink(rawEmail: string): Promise<void> {
  const email = normalizeEmail(rawEmail);

  const admin = getAdminClient();
  const { data: rep } = await admin
    .from("hq_sales_reps")
    .select("id")
    .eq("email", email)
    .eq("active", true)
    .maybeSingle();
  if (!rep) return;

  const h = headers();
  const origin =
    h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=/rep`, shouldCreateUser: true },
  });
  if (error) {
    console.error("[rep login] signInWithOtp failed:", error.message);
    throw new Error("Couldn't send the link right now. Try again in a minute.");
  }
}

export async function submitRepClaim(input: {
  customerEmail: string;
  customerName: string | null;
  kind: SalesClaimKind;
  note: string | null;
}): Promise<void> {
  const { repId } = await requireRep();
  if (!SALES_CLAIM_KINDS.includes(input.kind)) throw new Error("Pick a customer type");
  const email = normalizeEmail(input.customerEmail);
  const customerName = input.customerName?.trim() || null;
  if (customerName && customerName.length > 100) throw new Error("Name must be 100 characters or fewer");
  const note = input.note?.trim() || null;
  if (note && note.length > 500) throw new Error("Note must be 500 characters or fewer");

  const supabase = createSupabaseServerClient();

  // RLS only returns this rep's own claims, so this never reveals whether
  // another rep has claimed the same customer.
  const { data: existing } = await supabase
    .from("hq_sales_claims")
    .select("id")
    .eq("customer_email", email)
    .limit(1);
  if (existing && existing.length > 0) throw new Error("You've already submitted this customer");

  const { error } = await supabase.from("hq_sales_claims").insert({
    rep_id: repId,
    customer_email: email,
    customer_name: customerName,
    kind: input.kind,
    rep_note: note,
  });
  if (error) throw new Error("Couldn't submit that customer. Try again.");
  revalidatePath("/rep");
}

export async function repSignOut(): Promise<void> {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/rep/login");
}
