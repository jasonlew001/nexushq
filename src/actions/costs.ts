"use server";

import { revalidatePath } from "next/cache";
import { requireFounder } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { PEOPLE, type Cadence, type Person } from "@/lib/data/costs";

// The only write path in the app. Every action re-checks requireFounder()
// even though the DB's RLS policies (public.is_founder()) enforce the same
// gate — defense in depth, and it fails fast with a clear error instead of
// a bare RLS-denial from Postgres.

export interface CostInput {
  service: string;
  amountCents: number;
  cadence: Cadence;
  oneTimeMonth?: string | null;
  notes?: string | null;
  paidBy?: Person[];
}

function validateCreate(input: CostInput) {
  if (!input.service.trim() || input.service.length > 100) {
    throw new Error("Service name must be 1-100 characters");
  }
  if (!Number.isInteger(input.amountCents) || input.amountCents < 0) {
    throw new Error("Amount must be a non-negative integer number of cents");
  }
  if (!["monthly", "annual", "one_time"].includes(input.cadence)) {
    throw new Error("Invalid cadence");
  }
  if (input.cadence === "one_time" && !input.oneTimeMonth) {
    throw new Error("One-time costs require a month");
  }
  if (input.notes && input.notes.length > 500) {
    throw new Error("Notes must be 500 characters or fewer");
  }
  if (input.paidBy?.some((p) => !PEOPLE.includes(p))) {
    throw new Error("Unknown person in paid_by");
  }
}

export async function createCost(input: CostInput): Promise<void> {
  await requireFounder();
  validateCreate(input);

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("hq_manual_costs").insert({
    service: input.service.trim(),
    amount_cents: input.amountCents,
    cadence: input.cadence,
    one_time_month: input.oneTimeMonth ?? null,
    notes: input.notes?.trim() || null,
    paid_by: input.paidBy ?? [],
  });

  if (error) throw new Error(`Failed to create cost: ${error.message}`);
  revalidatePath("/");
}

export async function updateCost(id: string, input: CostInput): Promise<void> {
  await requireFounder();
  validateCreate(input);

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("hq_manual_costs")
    .update({
      service: input.service.trim(),
      amount_cents: input.amountCents,
      cadence: input.cadence,
      one_time_month: input.cadence === "one_time" ? input.oneTimeMonth ?? null : null,
      notes: input.notes?.trim() || null,
      paid_by: input.paidBy ?? [],
    })
    .eq("id", id);

  if (error) throw new Error(`Failed to update cost: ${error.message}`);
  revalidatePath("/");
}

export async function setCostActive(id: string, isActive: boolean): Promise<void> {
  await requireFounder();
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("hq_manual_costs")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) throw new Error(`Failed to update cost: ${error.message}`);
  revalidatePath("/");
}

export async function deleteCost(id: string): Promise<void> {
  await requireFounder();
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("hq_manual_costs").delete().eq("id", id);

  if (error) throw new Error(`Failed to delete cost: ${error.message}`);
  revalidatePath("/");
}
