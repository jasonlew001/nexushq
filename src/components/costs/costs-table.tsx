"use client";

import { useState, useTransition } from "react";
import { Trash2, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { setCostActive, deleteCost, updateCost } from "@/actions/costs";
import { formatCentsPrecise } from "@/lib/format";
import { PEOPLE, type Person } from "@/lib/constants";
import type { ManualCost, Cadence } from "@/lib/data/costs";

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

// Inline editor for one cost row — same fields as the entry form,
// pre-populated. Saving goes through the updateCost server action (same
// validation as create; RLS founder-only underneath).
function CostEditRow({ cost, onDone }: { cost: ManualCost; onDone: () => void }) {
  const [service, setService] = useState(cost.service);
  const [amount, setAmount] = useState((cost.amountCents / 100).toFixed(2));
  const [cadence, setCadence] = useState<Cadence>(cost.cadence);
  const [oneTimeMonth, setOneTimeMonth] = useState(cost.oneTimeMonth?.slice(0, 7) ?? "");
  const [notes, setNotes] = useState(cost.notes ?? "");
  const [paidBy, setPaidBy] = useState<Person[]>(cost.paidBy);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function togglePerson(person: Person) {
    setPaidBy((prev) =>
      prev.includes(person) ? prev.filter((p) => p !== person) : [...prev, person]
    );
  }

  function handleSave() {
    setError(null);
    const dollars = Number(amount);
    if (!Number.isFinite(dollars) || dollars < 0) {
      setError("Enter a valid amount");
      return;
    }
    if (cadence === "one_time" && !/^\d{4}-\d{2}$/.test(oneTimeMonth)) {
      setError("Pick a month for the one-time cost");
      return;
    }

    startTransition(async () => {
      try {
        await updateCost(cost.id, {
          service,
          amountCents: Math.round(dollars * 100),
          cadence,
          oneTimeMonth: cadence === "one_time" ? `${oneTimeMonth}-01` : null,
          notes: notes || null,
          paidBy,
        });
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  return (
    <div className="space-y-2 rounded-md bg-surface-2/60 px-2 py-2.5">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[110px] flex-1">
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-faint">Service</label>
          <input
            required
            maxLength={100}
            value={service}
            onChange={(e) => setService(e.target.value)}
            className="w-full rounded-md border border-edge bg-surface px-2 py-1.5 text-xs outline-none focus:border-edge-strong"
          />
        </div>
        <div className="w-24">
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-faint">Amount ($)</label>
          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="tnum w-full rounded-md border border-edge bg-surface px-2 py-1.5 text-xs outline-none focus:border-edge-strong"
          />
        </div>
        <div className="w-28">
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-faint">Cadence</label>
          <select
            value={cadence}
            onChange={(e) => setCadence(e.target.value as Cadence)}
            className="w-full rounded-md border border-edge bg-surface px-2 py-1.5 text-xs outline-none focus:border-edge-strong"
          >
            <option value="monthly">Monthly</option>
            <option value="annual">Annual</option>
            <option value="one_time">One-time</option>
          </select>
        </div>
        {cadence === "one_time" && (
          <div className="w-32">
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-faint">Month</label>
            <input
              required
              type="month"
              value={oneTimeMonth}
              onChange={(e) => setOneTimeMonth(e.target.value)}
              className="w-full rounded-md border border-edge bg-surface px-2 py-1.5 text-xs outline-none [color-scheme:dark] focus:border-edge-strong"
            />
          </div>
        )}
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-faint">Paid by</label>
          <div className="flex gap-2 py-1.5">
            {PEOPLE.map((person) => (
              <label key={person} className="flex items-center gap-1 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={paidBy.includes(person)}
                  onChange={() => togglePerson(person)}
                  className="accent-accent"
                />
                {PERSON_LABEL[person]}
              </label>
            ))}
          </div>
        </div>
        <div className="min-w-[120px] flex-1">
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-faint">Notes</label>
          <input
            maxLength={500}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-md border border-edge bg-surface px-2 py-1.5 text-xs outline-none focus:border-edge-strong"
          />
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={onDone}
            disabled={isPending}
            className="rounded-md border border-edge px-3 py-1.5 text-xs text-muted transition-colors hover:text-ink disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

export function CostsTable({ costs }: { costs: ManualCost[] }) {
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);

  if (costs.length === 0) {
    return <p className="py-2 text-xs text-faint">No manual costs entered yet.</p>;
  }

  return (
    <div className="divide-y divide-edge">
      {costs.map((cost) =>
        editingId === cost.id ? (
          <div key={cost.id} className="py-2">
            <CostEditRow cost={cost} onDone={() => setEditingId(null)} />
          </div>
        ) : (
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
                onClick={() => setEditingId(cost.id)}
                className="text-faint transition-colors hover:text-accent disabled:opacity-50"
                aria-label={`Edit ${cost.service}`}
              >
                <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
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
        )
      )}
    </div>
  );
}
