"use client";

import { useState, useTransition } from "react";
import { Card, SectionLabel } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { markPayoutPaid, undoPayout } from "@/actions/sales";
import { formatCentsWhole, formatDate } from "@/lib/format";
import type { SalesClaim, SalesPayout, SalesRep } from "@/lib/data/sales";

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function monthLabel(month: string): string {
  return new Date(`${month}-01T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Every month from the first rep's start through the current one, newest first.
function monthOptions(reps: SalesRep[]): string[] {
  const now = currentMonth();
  const start = reps.reduce((min, r) => (r.createdAt.slice(0, 7) < min ? r.createdAt.slice(0, 7) : min), now);
  const months: string[] = [];
  const d = new Date(`${start}-01T00:00:00Z`);
  while (d.toISOString().slice(0, 7) <= now) {
    months.push(d.toISOString().slice(0, 7));
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return months.reverse();
}

function StatementRow({
  rep,
  month,
  lines,
  payout,
}: {
  rep: SalesRep;
  month: string;
  lines: SalesClaim[];
  payout: SalesPayout | undefined;
}) {
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const liveCommission = lines.reduce((sum, c) => sum + c.commissionCents, 0);
  const salary = payout?.salaryCents ?? rep.monthlySalaryCents;
  const commission = payout?.commissionCents ?? liveCommission;
  const total = salary + commission;
  // Commission confirmed for this month after it was already marked paid.
  const unpaid = payout ? liveCommission - payout.commissionCents : 0;

  function pay() {
    setError(null);
    startTransition(async () => {
      try {
        await markPayoutPaid(rep.id, month, reference || null);
        setReference("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to mark paid");
      }
    });
  }

  function undo() {
    if (!payout || !confirm(`Undo the ${monthLabel(month)} payout record for ${rep.name}?`)) return;
    startTransition(async () => {
      try {
        await undoPayout(payout.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to undo");
      }
    });
  }

  return (
    <li className="border-t border-edge py-3">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <span className="min-w-[120px] flex-1 text-[13px] font-medium">{rep.name}</span>
        <span className="text-xs text-muted">
          Salary <span className="tnum text-ink">{formatCentsWhole(salary)}</span>
        </span>
        <span className="text-xs text-muted">
          Commission ({payout ? payout.lineItems.length : lines.length}){" "}
          <span className="tnum text-ink">{formatCentsWhole(commission)}</span>
        </span>
        <span className="tnum w-20 text-right text-[15px] font-semibold">{formatCentsWhole(total)}</span>
      </div>

      {(payout ? payout.lineItems.length : lines.length) > 0 && (
        <ul className="mt-1.5 space-y-0.5 pl-3 text-xs text-faint">
          {(payout
            ? payout.lineItems.map((l) => ({
                id: l.claimId,
                email: l.customerName || l.customerEmail || "Customer",
                cents: l.commissionCents,
              }))
            : lines.map((c) => ({ id: c.id, email: c.customerName || c.customerEmail || "Customer", cents: c.commissionCents }))
          ).map((l) => (
            <li key={l.id} className="flex justify-between gap-3">
              <span className="truncate">{l.email}</span>
              <span className="tnum">{formatCentsWhole(l.cents)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {payout ? (
          <>
            <Badge tone="accent">Paid {formatDate(payout.paidAt)}</Badge>
            {payout.paymentReference && (
              <span className="break-all text-xs text-faint">{payout.paymentReference}</span>
            )}
            <button
              type="button"
              onClick={undo}
              disabled={isPending}
              className="ml-auto text-xs text-faint hover:text-danger disabled:opacity-60"
            >
              Undo
            </button>
          </>
        ) : (
          <>
            <input
              maxLength={200}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Payment reference (optional), e.g. Venmo 4/30"
              className="min-w-[200px] flex-1 rounded-md border border-edge bg-surface-2 px-2 py-1.5 text-xs outline-none focus:border-edge-strong"
            />
            <button
              type="button"
              onClick={pay}
              disabled={isPending || total === 0}
              className="rounded-md border border-accent bg-accent px-3 py-1.5 text-xs text-bg disabled:opacity-60"
            >
              Mark {formatCentsWhole(total)} paid
            </button>
          </>
        )}
      </div>
      {unpaid !== 0 && (
        <p className="mt-1.5 text-xs text-warn">
          {formatCentsWhole(Math.abs(unpaid))} {unpaid > 0 ? "confirmed after this was paid — owed on top" : "less than paid (a claim changed since)"}
        </p>
      )}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </li>
  );
}

export function PayoutsCard({
  reps,
  claims,
  payouts,
}: {
  reps: SalesRep[];
  claims: SalesClaim[];
  payouts: SalesPayout[];
}) {
  const months = monthOptions(reps);
  const [month, setMonth] = useState(months[0] ?? currentMonth());

  const confirmed = claims.filter((c) => c.status === "confirmed" && c.earnedMonth === month);
  // Active reps always get a row; inactive ones only if they earned or were paid.
  const rows = reps
    .map((rep) => ({
      rep,
      lines: confirmed.filter((c) => c.repId === rep.id),
      payout: payouts.find((p) => p.repId === rep.id && p.periodMonth === month),
    }))
    .filter((r) => r.rep.active || r.lines.length > 0 || r.payout);

  const owed = rows
    .filter((r) => !r.payout)
    .reduce((sum, r) => sum + r.rep.monthlySalaryCents + r.lines.reduce((s, c) => s + c.commissionCents, 0), 0);

  return (
    <Card>
      <SectionLabel aside={rows.length > 0 ? `${formatCentsWhole(owed)} unpaid` : undefined}>
        Month-end payouts
      </SectionLabel>
      <div className="mb-1 flex items-center gap-2">
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-md border border-edge bg-surface-2 px-2 py-1 text-xs outline-none"
          aria-label="Payout month"
        >
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
        <span className="text-xs text-faint">
          {confirmed.length} confirmed sale{confirmed.length === 1 ? "" : "s"} this month
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="pt-2 text-xs text-faint">No reps yet.</p>
      ) : (
        <ul>
          {rows.map((r) => (
            <StatementRow
              key={`${r.rep.id}:${month}`}
              rep={r.rep}
              month={month}
              lines={r.lines}
              payout={r.payout}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}
