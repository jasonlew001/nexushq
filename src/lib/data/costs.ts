import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { PEOPLE, UNASSIGNED, type Person } from "@/lib/constants";

export type Cadence = "monthly" | "annual" | "one_time";
// Re-exported for server-side callers; client components import from
// @/lib/constants directly (this module pulls in server-only code).
export { PEOPLE, UNASSIGNED };
export type { Person };

export interface ManualCost {
  id: string;
  service: string;
  amountCents: number;
  cadence: Cadence;
  oneTimeMonth: string | null;
  notes: string | null;
  isActive: boolean;
  paidBy: Person[];
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
  paid_by: Person[] | null;
  created_at: string;
  updated_at: string;
}

export const getManualCosts = cache(async (): Promise<ManualCost[]> => {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hq_manual_costs")
    .select(
      "id, service, amount_cents, cadence, one_time_month, notes, is_active, paid_by, created_at, updated_at"
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
    paidBy: row.paid_by ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
});

// Monthly-equivalent contribution of one cost toward a given month:
// monthly = full amount, annual = /12, one_time = full amount only in its
// target month. Zero when inactive.
export function costMonthlyCents(cost: ManualCost, monthKey: string): number {
  if (!cost.isActive) return 0;
  if (cost.cadence === "monthly") return cost.amountCents;
  if (cost.cadence === "annual") return cost.amountCents / 12;
  if (cost.cadence === "one_time" && cost.oneTimeMonth?.slice(0, 7) === monthKey) {
    return cost.amountCents;
  }
  return 0;
}

export function monthlyBurnCents(costs: ManualCost[], monthKey: string): number {
  return costs.reduce((sum, c) => sum + costMonthlyCents(c, monthKey), 0);
}

// Who fronts what for a month — combos split evenly; costs with no names
// land in the "unassigned" bucket.
export function perPersonMonthlyCents(
  costs: ManualCost[],
  monthKey: string
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const cost of costs) {
    const monthly = costMonthlyCents(cost, monthKey);
    if (monthly === 0) continue;
    const people = cost.paidBy.length > 0 ? cost.paidBy : [UNASSIGNED];
    const share = monthly / people.length;
    for (const person of people) {
      totals[person] = (totals[person] ?? 0) + share;
    }
  }
  return totals;
}

// Per-service monthly contributions across a set of months — feeds the
// stacked manual-costs chart. Service names are user text; the chart
// renders them as plain text only (JSX-escaped).
export function serviceMonthlyBreakdown(
  costs: ManualCost[],
  monthKeys: string[]
): { month: string; byService: Record<string, number> }[] {
  return monthKeys.map((month) => {
    const byService: Record<string, number> = {};
    for (const cost of costs) {
      const monthly = costMonthlyCents(cost, month);
      if (monthly === 0) continue;
      byService[cost.service] = (byService[cost.service] ?? 0) + monthly;
    }
    return { month, byService };
  });
}
