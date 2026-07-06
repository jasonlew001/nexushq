"use client";

import { useState, useTransition } from "react";
import { createCost } from "@/actions/costs";
import type { Cadence } from "@/lib/data/costs";

export function CostEntryForm() {
  const [service, setService] = useState("");
  const [amount, setAmount] = useState("");
  const [cadence, setCadence] = useState<Cadence>("monthly");
  const [oneTimeMonth, setOneTimeMonth] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const dollars = Number(amount);
    if (!Number.isFinite(dollars) || dollars < 0) {
      setError("Enter a valid amount");
      return;
    }

    startTransition(async () => {
      try {
        await createCost({
          service,
          amountCents: Math.round(dollars * 100),
          cadence,
          oneTimeMonth: cadence === "one_time" ? oneTimeMonth || null : null,
          notes: notes || null,
        });
        setService("");
        setAmount("");
        setCadence("monthly");
        setOneTimeMonth("");
        setNotes("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add cost");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 border-t border-edge pt-3">
      <div className="min-w-[120px] flex-1">
        <label className="mb-1 block text-[10px] uppercase tracking-wider text-faint">Service</label>
        <input
          required
          maxLength={100}
          value={service}
          onChange={(e) => setService(e.target.value)}
          placeholder="Vercel"
          className="w-full rounded-md border border-edge bg-surface-2 px-2 py-1.5 text-xs outline-none focus:border-edge-strong"
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
          className="w-full rounded-md border border-edge bg-surface-2 px-2 py-1.5 text-xs tnum outline-none focus:border-edge-strong"
        />
      </div>
      <div className="w-28">
        <label className="mb-1 block text-[10px] uppercase tracking-wider text-faint">Cadence</label>
        <select
          value={cadence}
          onChange={(e) => setCadence(e.target.value as Cadence)}
          className="w-full rounded-md border border-edge bg-surface-2 px-2 py-1.5 text-xs outline-none focus:border-edge-strong"
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
            onChange={(e) => setOneTimeMonth(`${e.target.value}-01`)}
            className="w-full rounded-md border border-edge bg-surface-2 px-2 py-1.5 text-xs outline-none focus:border-edge-strong"
          />
        </div>
      )}
      <div className="min-w-[140px] flex-1">
        <label className="mb-1 block text-[10px] uppercase tracking-wider text-faint">Notes</label>
        <input
          maxLength={500}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-md border border-edge bg-surface-2 px-2 py-1.5 text-xs outline-none focus:border-edge-strong"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Adding…" : "Add"}
      </button>
      {error && <p className="w-full text-xs text-danger">{error}</p>}
    </form>
  );
}
