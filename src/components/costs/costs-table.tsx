"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { setCostActive, deleteCost } from "@/actions/costs";
import { formatCentsPrecise } from "@/lib/format";
import type { ManualCost } from "@/lib/data/costs";

const CADENCE_LABEL: Record<ManualCost["cadence"], string> = {
  monthly: "/mo",
  annual: "/yr",
  one_time: "one-time",
};

const PERSON_LABEL: Record<string, string> = {
  nick: "Nick",
  jason: "Jason",
  kamp: "Kamp",
};

export function CostsTable({ costs }: { costs: ManualCost[] }) {
  const [isPending, startTransition] = useTransition();

  if (costs.length === 0) {
    return <p className="py-2 text-xs text-faint">No manual costs entered yet.</p>;
  }

  return (
    <div className="divide-y divide-edge">
      {costs.map((cost) => (
        <div key={cost.id} className="flex items-center justify-between gap-3 py-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className={`truncate text-sm ${cost.isActive ? "" : "text-faint line-through"}`}>
                {cost.service}
              </p>
              <Badge tone="neutral">manual</Badge>
              {cost.paidBy.length > 0 && (
                <Badge tone="gold">
                  {cost.paidBy.map((p) => PERSON_LABEL[p] ?? p).join(" + ")}
                </Badge>
              )}
            </div>
            {cost.notes && <p className="truncate text-xs text-faint">{cost.notes}</p>}
          </div>
          <p className="tnum whitespace-nowrap text-sm">
            {formatCentsPrecise(cost.amountCents)}
            <span className="text-faint"> {CADENCE_LABEL[cost.cadence]}</span>
          </p>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-faint">
              <input
                type="checkbox"
                checked={cost.isActive}
                disabled={isPending}
                onChange={(e) =>
                  startTransition(() => setCostActive(cost.id, e.target.checked))
                }
                className="accent-accent"
              />
              active
            </label>
            <button
              disabled={isPending}
              onClick={() => startTransition(() => deleteCost(cost.id))}
              className="text-faint transition-colors hover:text-danger disabled:opacity-50"
              aria-label={`Delete ${cost.service}`}
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
