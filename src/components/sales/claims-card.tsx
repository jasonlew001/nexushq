"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronRight } from "lucide-react";
import { Card, SectionLabel } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { createClaim, deleteClaim, saveClaimReview } from "@/actions/sales";
import { formatCentsWhole, formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { REP_ACADEMY_CUT, SALES_CLAIM_KINDS, type RepPlan, type SalesClaimKind } from "@/lib/constants";
import type { ClaimStatus, SalesClaim, SalesRep } from "@/lib/data/sales";

const LABEL = "mb-1 block text-[10px] uppercase tracking-wider text-faint";
const INPUT =
  "w-full rounded-md border border-edge bg-surface-2 px-2 py-1.5 text-xs outline-none focus:border-edge-strong";

const KIND_LABEL: Record<SalesClaimKind, string> = {
  individual: "Individual",
  academy: "Academy",
  tour: "Junior tour",
};

const PLAN_LABEL: Record<RepPlan, string> = {
  monthly: "Monthly",
  six_month: "6-Month",
  annual: "Annual",
};

const STATUS: Record<ClaimStatus, { label: string; tone: "neutral" | "accent" | "gold" | "danger" | "warn" }> = {
  confirmed: { label: "Confirmed", tone: "accent" },
  waiting_signup: { label: "Waiting for signup", tone: "neutral" },
  not_paid: { label: "Signed up, not paid", tone: "neutral" },
  needs_amount: { label: "Needs amount", tone: "gold" },
  plan_unknown: { label: "Plan unknown", tone: "gold" },
  paid_before_claim: { label: "Paid before claim", tone: "warn" },
  conflict: { label: "Conflict", tone: "danger" },
  rejected: { label: "Rejected", tone: "neutral" },
};

type View = "review" | "pending" | "confirmed" | "rejected" | "all";

const VIEWS: { key: View; label: string; statuses: ClaimStatus[] | null }[] = [
  { key: "all", label: "All", statuses: null },
  { key: "review", label: "Needs review", statuses: ["needs_amount", "plan_unknown", "paid_before_claim", "conflict"] },
  { key: "pending", label: "Pending", statuses: ["waiting_signup", "not_paid"] },
  { key: "confirmed", label: "Confirmed", statuses: ["confirmed"] },
  { key: "rejected", label: "Rejected", statuses: ["rejected"] },
];

function toCents(dollars: string): number | null {
  const n = Number(dollars);
  return dollars.trim() === "" || !Number.isFinite(n) || n < 0 ? null : Math.round(n * 100);
}

function centsToInput(cents: number | null | undefined): string {
  return cents == null ? "" : String(cents / 100);
}

function ClaimReview({ claim }: { claim: SalesClaim }) {
  const [linkedEmail, setLinkedEmail] = useState(claim.linkedManually ? claim.matchedEmail ?? "" : "");
  const [payment, setPayment] = useState(centsToInput(claim.review?.paymentCents));
  const [commission, setCommission] = useState(centsToInput(claim.review?.commissionCents));
  const [earnedOn, setEarnedOn] = useState(claim.review?.earnedOn ?? "");
  const [note, setNote] = useState(claim.review?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save(rejected: boolean) {
    setError(null);
    if (payment.trim() && toCents(payment) == null) return setError("Enter a valid payment amount");
    if (commission.trim() && toCents(commission) == null) return setError("Enter a valid commission");
    startTransition(async () => {
      try {
        await saveClaimReview(claim.id, {
          rejected,
          linkedEmail: linkedEmail || null,
          paymentCents: toCents(payment),
          commissionCents: toCents(commission),
          earnedOn: earnedOn || null,
          note: note || null,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  function remove() {
    if (!confirm(`Delete the claim for ${claim.customerEmail}? This can't be undone.`)) return;
    startTransition(async () => {
      try {
        await deleteClaim(claim.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete");
      }
    });
  }

  const paymentPreview = toCents(payment);

  return (
    <div className="space-y-3 pb-3 pl-6 pr-1">
      <div className="grid gap-x-6 gap-y-1 text-xs text-muted sm:grid-cols-2">
        <p>
          Account:{" "}
          {claim.matchedEmail ? (
            <span className="break-all text-ink">
              {claim.matchedEmail}
              {claim.linkedManually && " (linked by hand)"}
            </span>
          ) : (
            <span className="text-faint">no main-site account with this email yet</span>
          )}
        </p>
        <p>
          First payment:{" "}
          {claim.firstPaidAt ? (
            <span className="tnum text-ink">
              {formatDate(claim.firstPaidAt)} · {formatCentsWhole(claim.firstPaidCents ?? 0)}
              {claim.plan && ` · ${PLAN_LABEL[claim.plan]}`}
            </span>
          ) : (
            <span className="text-faint">{claim.kind === "individual" ? "none yet" : "entered below"}</span>
          )}
        </p>
        <p>
          Claimed: <span className="tnum text-ink">{formatDate(claim.claimedAt)}</span>
        </p>
        {claim.conflictWithRep && (
          <p className="text-danger">Already claimed earlier by {claim.conflictWithRep}</p>
        )}
        {claim.repNote && (
          <p className="whitespace-pre-wrap break-words sm:col-span-2">Rep note: {claim.repNote}</p>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[180px] flex-1">
          <label className={LABEL}>Link to account email</label>
          <input
            type="email"
            value={linkedEmail}
            onChange={(e) => setLinkedEmail(e.target.value)}
            placeholder="Only if they signed up with a different email"
            className={INPUT}
          />
        </div>
        {claim.kind === "academy" && (
          <div className="w-36">
            <label className={LABEL}>First payment ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={payment}
              onChange={(e) => setPayment(e.target.value)}
              className={`${INPUT} tnum`}
            />
          </div>
        )}
        <div className="w-36">
          <label className={LABEL}>{claim.kind === "tour" ? "Flat rate ($)" : "Override ($)"}</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={commission}
            onChange={(e) => setCommission(e.target.value)}
            placeholder={claim.kind === "tour" ? "" : "Leave blank"}
            className={`${INPUT} tnum`}
          />
        </div>
        <div className="w-36">
          <label className={LABEL}>Payout date</label>
          <input
            type="date"
            value={earnedOn}
            onChange={(e) => setEarnedOn(e.target.value)}
            className={INPUT}
            title="Which month's payout a manual amount lands in. Blank = today."
          />
        </div>
      </div>
      {claim.kind === "academy" && paymentPreview != null && !commission.trim() && (
        <p className="text-xs text-muted">
          Commission: {Math.round(REP_ACADEMY_CUT * 100)}% ={" "}
          <span className="tnum text-ink">{formatCentsWhole(Math.round(paymentPreview * REP_ACADEMY_CUT))}</span>
        </p>
      )}

      <div>
        <label className={LABEL}>Internal note</label>
        <textarea
          maxLength={1000}
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Only visible in HQ"
          className={`${INPUT} resize-y`}
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => save(false)}
          disabled={isPending}
          className="rounded-md border border-accent bg-accent px-3 py-1.5 text-xs text-bg disabled:opacity-60"
        >
          {claim.status === "rejected" ? "Restore & save" : "Save"}
        </button>
        {claim.status !== "rejected" && (
          <button
            type="button"
            onClick={() => save(true)}
            disabled={isPending}
            className="rounded-md border border-edge px-3 py-1.5 text-xs text-muted hover:text-ink disabled:opacity-60"
          >
            Reject
          </button>
        )}
        <button
          type="button"
          onClick={remove}
          disabled={isPending}
          className="ml-auto text-xs text-faint hover:text-danger disabled:opacity-60"
        >
          Delete claim
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

function AddClaimForm({ reps }: { reps: SalesRep[] }) {
  const activeReps = reps.filter((r) => r.active);
  const [repId, setRepId] = useState(activeReps[0]?.id ?? "");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<SalesClaimKind>("individual");
  const [claimedOn, setClaimedOn] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (activeReps.length === 0) {
    return <p className="border-t border-edge pt-3 text-xs text-faint">Add a rep below to start logging claims.</p>;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createClaim({
          repId,
          customerEmail: email,
          customerName: name || null,
          kind,
          repNote: note || null,
          claimedOn: claimedOn || null,
        });
        setEmail("");
        setName("");
        setClaimedOn("");
        setNote("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add claim");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 border-t border-edge pt-3">
      <div className="w-36">
        <label className={LABEL}>Rep</label>
        <select value={repId} onChange={(e) => setRepId(e.target.value)} className={INPUT}>
          {activeReps.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-[180px] flex-1">
        <label className={LABEL}>Customer email</label>
        <input
          required
          type="email"
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={INPUT}
        />
      </div>
      <div className="min-w-[120px] flex-1">
        <label className={LABEL}>Name (optional)</label>
        <input maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className={INPUT} />
      </div>
      <div className="w-32">
        <label className={LABEL}>Type</label>
        <select value={kind} onChange={(e) => setKind(e.target.value as SalesClaimKind)} className={INPUT}>
          {SALES_CLAIM_KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </div>
      <div className="w-36">
        <label className={LABEL}>Claimed on</label>
        <input
          type="date"
          value={claimedOn}
          onChange={(e) => setClaimedOn(e.target.value)}
          className={INPUT}
          title="Blank = now. Set it if the rep told you about this customer earlier."
        />
      </div>
      <div className="min-w-[160px] flex-[2]">
        <label className={LABEL}>Note (optional)</label>
        <input maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className={INPUT} />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md border border-accent bg-accent px-3 py-1.5 text-xs text-bg disabled:opacity-60"
      >
        Add claim
      </button>
      {error && <p className="w-full text-xs text-danger">{error}</p>}
    </form>
  );
}

export function ClaimsCard({ reps, claims }: { reps: SalesRep[]; claims: SalesClaim[] }) {
  const [view, setView] = useState<View>("all");
  const [repFilter, setRepFilter] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c = new Map<View, number>();
    for (const v of VIEWS) {
      c.set(v.key, claims.filter((cl) => !v.statuses || v.statuses.includes(cl.status)).length);
    }
    return c;
  }, [claims]);

  const statuses = VIEWS.find((v) => v.key === view)?.statuses ?? null;
  const visible = claims.filter(
    (c) => (!statuses || statuses.includes(c.status)) && (repFilter === "all" || c.repId === repFilter)
  );

  return (
    <Card>
      <SectionLabel aside="Matched by email to main-site accounts and their first Stripe payment">
        Claims
      </SectionLabel>

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => setView(v.key)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs transition-colors",
              view === v.key ? "border-accent bg-accent text-bg" : "border-edge text-muted hover:text-ink"
            )}
          >
            {v.label} <span className="tnum opacity-70">{counts.get(v.key) ?? 0}</span>
          </button>
        ))}
        {reps.length > 1 && (
          <select
            value={repFilter}
            onChange={(e) => setRepFilter(e.target.value)}
            className="ml-auto rounded-md border border-edge bg-surface-2 px-2 py-1 text-xs outline-none"
            aria-label="Filter by rep"
          >
            <option value="all">All reps</option>
            {reps.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {visible.length === 0 ? (
        <EmptyState label={claims.length === 0 ? "No claims yet" : "Nothing in this view"} />
      ) : (
        <ul className="mb-3">
          {visible.map((c) => {
            const open = openId === c.id;
            return (
              <li key={c.id} className="border-t border-edge">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : c.id)}
                  aria-expanded={open}
                  className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 py-2 text-left"
                >
                  <ChevronRight
                    className={cn("h-3.5 w-3.5 shrink-0 text-faint transition-transform", open && "rotate-90")}
                    strokeWidth={1.75}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px]">{c.customerName || c.customerEmail}</span>
                    <span className="block truncate text-xs text-faint">
                      {c.customerName ? `${c.customerEmail} · ` : ""}
                      {c.repName} · {KIND_LABEL[c.kind]} · {formatDate(c.claimedAt)}
                    </span>
                  </span>
                  <Badge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Badge>
                  <span className="tnum w-16 text-right text-[13px]">
                    {c.status === "confirmed" ? formatCentsWhole(c.commissionCents) : "—"}
                  </span>
                </button>
                {open && <ClaimReview key={`${c.id}:${c.review ? JSON.stringify(c.review) : ""}`} claim={c} />}
              </li>
            );
          })}
        </ul>
      )}

      <AddClaimForm reps={reps} />
    </Card>
  );
}
