"use server";

import { revalidatePath } from "next/cache";
import { requireFounder } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getAllAuthUsers } from "@/lib/data/users";
import { commissionLines, getSalesData } from "@/lib/data/sales";
import { SALES_CLAIM_KINDS, type SalesClaimKind } from "@/lib/constants";

// Every action re-checks requireFounder() on top of RLS (founders_all,
// sql/012) — same defense-in-depth convention as actions/costs.ts.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MONTH_RE = /^\d{4}-\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeEmail(raw: string): string {
  const email = raw.trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) throw new Error("Enter a valid email");
  return email;
}

function validCents(n: number | null, label: string): number | null {
  if (n == null) return null;
  if (!Number.isInteger(n) || n < 0) throw new Error(`${label} must be a non-negative amount`);
  return n;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function createRep(input: {
  name: string;
  email: string;
  monthlySalaryCents: number;
}): Promise<void> {
  await requireFounder();
  const name = input.name.trim();
  if (!name || name.length > 100) throw new Error("Name must be 1-100 characters");

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("hq_sales_reps").insert({
    name,
    email: normalizeEmail(input.email),
    monthly_salary_cents: validCents(input.monthlySalaryCents, "Salary") ?? 0,
  });
  if (error) {
    throw new Error(
      error.code === "23505" ? "A rep with that email already exists" : `Failed to add rep: ${error.message}`
    );
  }
  revalidatePath("/sales");
}

export async function updateRep(
  id: string,
  input: { monthlySalaryCents: number; active: boolean }
): Promise<void> {
  await requireFounder();
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("hq_sales_reps")
    .update({
      monthly_salary_cents: validCents(input.monthlySalaryCents, "Salary") ?? 0,
      active: input.active,
    })
    .eq("id", id);
  if (error) throw new Error(`Failed to update rep: ${error.message}`);
  revalidatePath("/sales");
}

// Removes a deactivated rep and the claims they logged (reviews cascade).
// Refused once any payout is recorded for them — payouts are the money
// record, and their FK (on delete restrict) would block it anyway. Their
// Supabase login is left alone (it may be a main-site account); without a
// roster row it simply can't open the portal any more.
export async function deleteRep(id: string): Promise<void> {
  await requireFounder();
  const supabase = createSupabaseServerClient();

  const { data: rep, error: repError } = await supabase
    .from("hq_sales_reps")
    .select("active")
    .eq("id", id)
    .maybeSingle();
  if (repError) throw new Error(`Failed to load rep: ${repError.message}`);
  if (!rep) throw new Error("Rep not found");
  if (rep.active) throw new Error("Deactivate the rep before removing them");

  const { count, error: payoutError } = await supabase
    .from("hq_sales_payouts")
    .select("id", { count: "exact", head: true })
    .eq("rep_id", id);
  if (payoutError) throw new Error(`Failed to check payouts: ${payoutError.message}`);
  if (count) throw new Error("This rep has payout history, so they can't be removed. Keep them deactivated.");

  const { error: claimsError } = await supabase.from("hq_sales_claims").delete().eq("rep_id", id);
  if (claimsError) throw new Error(`Failed to remove claims: ${claimsError.message}`);
  const { error } = await supabase.from("hq_sales_reps").delete().eq("id", id);
  if (error) throw new Error(`Failed to remove rep: ${error.message}`);
  revalidatePath("/sales");
}

// Founder-entered claim (e.g. a rep texted it in before the rep portal
// exists). claimedOn backdates it — only founders can (trigger in sql/012).
export async function createClaim(input: {
  repId: string;
  customerEmail: string;
  customerName: string | null;
  kind: SalesClaimKind;
  repNote: string | null;
  claimedOn: string | null; // "YYYY-MM-DD", null = now
}): Promise<void> {
  await requireFounder();
  if (!input.repId) throw new Error("Pick a rep");
  if (!SALES_CLAIM_KINDS.includes(input.kind)) throw new Error("Invalid type");
  const customerName = input.customerName?.trim() || null;
  if (customerName && customerName.length > 100) throw new Error("Name must be 100 characters or fewer");
  const repNote = input.repNote?.trim() || null;
  if (repNote && repNote.length > 500) throw new Error("Note must be 500 characters or fewer");
  if (input.claimedOn && !DATE_RE.test(input.claimedOn)) throw new Error("Invalid claim date");

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("hq_sales_claims").insert({
    rep_id: input.repId,
    customer_email: normalizeEmail(input.customerEmail),
    customer_name: customerName,
    kind: input.kind,
    rep_note: repNote,
    ...(input.claimedOn ? { created_at: `${input.claimedOn}T12:00:00Z` } : {}),
  });
  if (error) throw new Error(`Failed to add claim: ${error.message}`);
  revalidatePath("/sales");
}

export async function deleteClaim(id: string): Promise<void> {
  await requireFounder();
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("hq_sales_claims").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete claim: ${error.message}`);
  revalidatePath("/sales");
}

export async function saveClaimReview(
  claimId: string,
  input: {
    rejected: boolean;
    linkedEmail: string | null; // the account's real email, if it differs
    paymentCents: number | null;
    commissionCents: number | null;
    earnedOn: string | null;
    note: string | null;
  }
): Promise<void> {
  const founder = await requireFounder();
  const note = input.note?.trim() || null;
  if (note && note.length > 1000) throw new Error("Note must be 1000 characters or fewer");
  if (input.earnedOn && !DATE_RE.test(input.earnedOn)) throw new Error("Invalid payout date");
  const paymentCents = validCents(input.paymentCents, "Payment");
  const commissionCents = validCents(input.commissionCents, "Commission");

  let linkedUserId: string | null = null;
  if (input.linkedEmail?.trim()) {
    const email = normalizeEmail(input.linkedEmail);
    const { data: users } = await getAllAuthUsers();
    const user = users.find((u) => u.email?.toLowerCase() === email);
    if (!user) throw new Error("No main-site account has that email");
    linkedUserId = user.id;
  }

  // Pin the payout month the first time an amount is entered, so a later
  // note edit (which bumps updated_at) can't move the commission.
  const earnedOn =
    input.earnedOn ?? (paymentCents != null || commissionCents != null ? today() : null);

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("hq_sales_claim_reviews").upsert(
    {
      claim_id: claimId,
      rejected: input.rejected,
      linked_user_id: linkedUserId,
      payment_cents: paymentCents,
      commission_cents: commissionCents,
      earned_on: earnedOn,
      note,
      updated_at: new Date().toISOString(),
      updated_by: founder.userId,
    },
    { onConflict: "claim_id" }
  );
  if (error) throw new Error(`Failed to save review: ${error.message}`);
  revalidatePath("/sales");
}

// Snapshots the rep's statement for the month as paid. Totals are recomputed
// here from live data — never taken from the client.
export async function markPayoutPaid(
  repId: string,
  month: string,
  paymentReference: string | null
): Promise<void> {
  const founder = await requireFounder();
  if (!MONTH_RE.test(month)) throw new Error("Invalid month");
  const reference = paymentReference?.trim() || null;
  if (reference && reference.length > 200) throw new Error("Reference must be 200 characters or fewer");

  const { reps, claims } = await getSalesData();
  const rep = reps.find((r) => r.id === repId);
  if (!rep) throw new Error("Unknown rep");

  const lines = commissionLines(claims, repId, month);
  const commissionCents = lines.reduce((sum, l) => sum + l.commissionCents, 0);

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("hq_sales_payouts").insert({
    rep_id: repId,
    period_month: `${month}-01`,
    salary_cents: rep.monthlySalaryCents,
    commission_cents: commissionCents,
    total_cents: rep.monthlySalaryCents + commissionCents,
    line_items: lines,
    payment_reference: reference,
    created_by: founder.userId,
  });
  if (error) {
    throw new Error(
      error.code === "23505" ? "Already marked paid for that month" : `Failed to record payout: ${error.message}`
    );
  }
  revalidatePath("/sales");
}

export async function undoPayout(payoutId: string): Promise<void> {
  await requireFounder();
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("hq_sales_payouts").delete().eq("id", payoutId);
  if (error) throw new Error(`Failed to undo payout: ${error.message}`);
  revalidatePath("/sales");
}
