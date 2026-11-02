"use server";

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

const MIN_PASSWORD = 8;

type AuthResult = { error: string } | { ok: true };

// Ordinary email + password sign-in. Server-side so the session cookies are
// set by the same Supabase SSR client every other HQ request reads.
export async function repSignIn(rawEmail: string, password: string): Promise<AuthResult> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: rawEmail.trim().toLowerCase(),
    password,
  });
  return error ? { error: "Wrong email or password." } : { ok: true };
}

// First-time setup, no email verification (Jason's call, 2026-11-01: a few
// reps on a one-month test; the accepted risk is that whoever sets the
// password first for a listed email owns that portal). Only ever CREATES an
// account: if one already exists for the email (the rep already set theirs,
// or they have a main-site account) it refuses, so this can never overwrite
// anyone's password. Service role: the caller has no session yet, so RLS
// would hide the roster, and creating a pre-confirmed user is admin-only.
export async function repSetPassword(rawEmail: string, password: string): Promise<AuthResult> {
  let email: string;
  try {
    email = normalizeEmail(rawEmail);
  } catch {
    return { error: "Enter a valid email." };
  }
  if (password.length < MIN_PASSWORD) {
    return { error: `Password must be at least ${MIN_PASSWORD} characters.` };
  }

  const admin = getAdminClient();
  const { data: rep } = await admin
    .from("hq_sales_reps")
    .select("id")
    .eq("email", email)
    .eq("active", true)
    .maybeSingle();
  if (!rep) return { error: "That email isn't set up as a rep. Check with Nexus." };

  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError) {
    if (createError.code === "email_exists" || /already/i.test(createError.message)) {
      return { error: "This email already has an account. Sign in with its password instead." };
    }
    console.error("[rep setup] createUser failed:", createError.message);
    return { error: createError.message };
  }

  return repSignIn(email, password);
}

// "  Jake  O'Brien " -> "jake o brien", for duplicate checks on name-only claims.
function nameKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z]+/g, " ").trim();
}

export async function submitRepClaim(input: {
  customerEmail: string | null; // optional: reps may not know it yet
  customerName: string | null;
  customerPhone: string | null;
  kind: SalesClaimKind;
  note: string | null;
}): Promise<void> {
  const { repId } = await requireRep();
  if (!SALES_CLAIM_KINDS.includes(input.kind)) throw new Error("Pick a customer type");
  const email = input.customerEmail?.trim() ? normalizeEmail(input.customerEmail) : null;
  const customerName = input.customerName?.trim() || null;
  if (customerName && customerName.length > 100) throw new Error("Name must be 100 characters or fewer");
  if (!email && (!customerName || customerName.length < 2)) {
    throw new Error("Enter their email, or their full name if you don't know it");
  }
  const customerPhone = input.customerPhone?.trim() || null;
  if (customerPhone && customerPhone.length > 30) throw new Error("Phone must be 30 characters or fewer");
  const note = input.note?.trim() || null;
  if (note && note.length > 500) throw new Error("Note must be 500 characters or fewer");

  const supabase = createSupabaseServerClient();

  // RLS only returns this rep's own claims, so this never reveals whether
  // another rep has claimed the same customer.
  if (email) {
    const { data: existing } = await supabase
      .from("hq_sales_claims")
      .select("id")
      .eq("customer_email", email)
      .limit(1);
    if (existing && existing.length > 0) throw new Error("You've already submitted this customer");
  } else {
    const { data: nameOnly } = await supabase
      .from("hq_sales_claims")
      .select("customer_name")
      .is("customer_email", null);
    const key = nameKey(customerName!);
    if ((nameOnly ?? []).some((r) => r.customer_name && nameKey(r.customer_name) === key)) {
      throw new Error("You've already submitted someone with this name");
    }
  }

  const { error } = await supabase.from("hq_sales_claims").insert({
    rep_id: repId,
    customer_email: email,
    customer_name: customerName,
    customer_phone: customerPhone,
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
