import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export type Cadence = "monthly" | "annual" | "one_time";

export interface ManualCost {
  id: string;
  service: string;
  amountCents: number;
  cadence: Cadence;
  oneTimeMonth: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ManualCostRow {
  id: string;
  service: string;
  amount_cents: number;
  cadence: Cadence;
  one_time_month: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const getManualCosts = cache(async (): Promise<ManualCost[]> => {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hq_manual_costs")
    .select(
      "id, service, amount_cents, cadence, one_time_month, notes, is_active, created_at, updated_at"
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load hq_manual_costs: ${error.message}`);
  }

  return ((data ?? []) as unknown as ManualCostRow[]).map((row) => ({
    id: row.id,
    service: row.service,
    amountCents: row.amount_cents,
    cadence: row.cadence,
    oneTimeMonth: row.one_time_month,
    notes: row.notes,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
});

// Monthly-equivalent contribution: monthly = full amount, annual = /12,
// one_time = full amount only in its target month. Inactive rows excluded.
export function monthlyBurnCents(costs: ManualCost[], monthKey: string): number {
  return costs
    .filter((c) => c.isActive)
    .reduce((sum, c) => {
      if (c.cadence === "monthly") return sum + c.amountCents;
      if (c.cadence === "annual") return sum + c.amountCents / 12;
      if (c.cadence === "one_time" && c.oneTimeMonth?.slice(0, 7) === monthKey) {
        return sum + c.amountCents;
      }
      return sum;
    }, 0);
}
