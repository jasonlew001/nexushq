"use client";

import { useState, useTransition } from "react";
import { Card, SectionLabel } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createRep, updateRep } from "@/actions/sales";
import type { SalesRep } from "@/lib/data/sales";

const LABEL = "mb-1 block text-[10px] uppercase tracking-wider text-faint";
const INPUT =
  "w-full rounded-md border border-edge bg-surface-2 px-2 py-1.5 text-xs outline-none focus:border-edge-strong";

function toCents(dollars: string): number | null {
  const n = Number(dollars);
  return dollars.trim() === "" || !Number.isFinite(n) || n < 0 ? null : Math.round(n * 100);
}

function RepRow({ rep }: { rep: SalesRep }) {
  const [salary, setSalary] = useState(String(rep.monthlySalaryCents / 100));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save(active: boolean) {
    setError(null);
    const cents = toCents(salary);
    if (cents == null) {
      setError("Enter a valid salary");
      return;
    }
    startTransition(async () => {
      try {
        await updateRep(rep.id, { monthlySalaryCents: cents, active });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  return (
    <tr className="border-t border-edge">
      <td className="py-2 pr-3">
        <div className="text-[13px]">{rep.name}</div>
        <div className="break-all text-xs text-faint">{rep.email}</div>
      </td>
      <td className="py-2 pr-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-faint">$</span>
          <input
            type="number"
            min="0"
            step="1"
            value={salary}
            onChange={(e) => setSalary(e.target.value)}
            className={`${INPUT} tnum w-24`}
            aria-label={`${rep.name} monthly salary`}
          />
          <button
            type="button"
            onClick={() => save(rep.active)}
            disabled={isPending}
            className="rounded-md border border-edge px-2 py-1 text-xs text-muted hover:text-ink disabled:opacity-60"
          >
            Save
          </button>
        </div>
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      </td>
      <td className="py-2 text-right">
        <div className="flex items-center justify-end gap-2">
          {rep.active ? <Badge tone="accent">Active</Badge> : <Badge>Inactive</Badge>}
          <button
            type="button"
            onClick={() => save(!rep.active)}
            disabled={isPending}
            className="text-xs text-muted hover:text-ink disabled:opacity-60"
          >
            {rep.active ? "Deactivate" : "Reactivate"}
          </button>
        </div>
      </td>
    </tr>
  );
}

export function RepsCard({ reps }: { reps: SalesRep[] }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [salary, setSalary] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cents = toCents(salary);
    if (cents == null) {
      setError("Enter a valid salary");
      return;
    }
    startTransition(async () => {
      try {
        await createRep({ name, email, monthlySalaryCents: cents });
        setName("");
        setEmail("");
        setSalary("0");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add rep");
      }
    });
  }

  return (
    <Card>
      <SectionLabel aside="Salary is per month; $0 = commission only">Reps</SectionLabel>
      {reps.length > 0 ? (
        <table className="mb-3 w-full text-left">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-faint">
              <th className="pb-1.5 font-normal">Rep</th>
              <th className="pb-1.5 font-normal">Monthly salary</th>
              <th className="pb-1.5" />
            </tr>
          </thead>
          <tbody>
            {reps.map((rep) => (
              <RepRow key={`${rep.id}:${rep.monthlySalaryCents}`} rep={rep} />
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mb-3 text-xs text-faint">No reps yet. Add one below.</p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 border-t border-edge pt-3">
        <div className="min-w-[140px] flex-1">
          <label className={LABEL}>Name</label>
          <input required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className={INPUT} />
        </div>
        <div className="min-w-[180px] flex-1">
          <label className={LABEL}>Login email</label>
          <input
            required
            type="email"
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={INPUT}
          />
        </div>
        <div className="w-28">
          <label className={LABEL}>Salary ($/mo)</label>
          <input
            required
            type="number"
            min="0"
            step="1"
            value={salary}
            onChange={(e) => setSalary(e.target.value)}
            className={`${INPUT} tnum`}
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md border border-accent bg-accent px-3 py-1.5 text-xs text-bg disabled:opacity-60"
        >
          Add rep
        </button>
        {error && <p className="w-full text-xs text-danger">{error}</p>}
      </form>
    </Card>
  );
}
