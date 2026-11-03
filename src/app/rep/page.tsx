import { notFound } from "next/navigation";
import { getRepAccess } from "@/lib/auth";
import { getRepPortalData, type RepClaimStatus } from "@/lib/data/sales";
import { repSignOut } from "@/actions/rep";
import { RepClaimForm } from "@/components/rep/rep-claim-form";
import { Badge } from "@/components/ui/badge";
import { formatCentsWhole, formatDate } from "@/lib/format";
import {
  REP_ACADEMY_CUT,
  REP_CLAIM_GRACE_DAYS,
  REP_PLAN_COMMISSION_CENTS,
  type SalesClaimKind,
} from "@/lib/constants";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<SalesClaimKind, string> = {
  individual: "Individual",
  academy: "Academy",
  tour: "Junior tour",
};

const STATUS: Record<RepClaimStatus, { label: string; tone: "neutral" | "accent" | "gold" }> = {
  pending: { label: "Pending", tone: "neutral" },
  review: { label: "Under review", tone: "gold" },
  confirmed: { label: "Confirmed", tone: "accent" },
  not_approved: { label: "Not approved", tone: "neutral" },
};

function monthLabel(month: string): string {
  return new Date(`${month}-01T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-edge bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="tnum mt-1 text-[24px] font-semibold tracking-[-0.02em]">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-faint">{hint}</p>}
    </div>
  );
}

function NotARep({ email }: { email: string | undefined }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm space-y-3 rounded-lg border border-edge bg-surface p-5">
        <p className="text-[15px] font-semibold">This isn&apos;t a rep account</p>
        <p className="text-sm text-muted">
          You&apos;re signed in as <span className="break-all text-ink">{email ?? "another account"}</span>,
          which isn&apos;t on the active rep list. Sign out to sign in as a rep.
        </p>
        <p className="text-xs text-faint">
          Signing out also signs this browser out of Nexus HQ. To try the rep portal without that, use a
          private window.
        </p>
        <form action={repSignOut}>
          <button
            type="submit"
            className="w-full rounded-md border border-accent bg-accent px-3 py-2 text-sm text-bg"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

export default async function RepHomePage() {
  const access = await getRepAccess();
  if ("notRep" in access) return <NotARep email={access.email} />;
  const data = await getRepPortalData(access.repId);
  if (!data) notFound();

  const month = new Date().toISOString().slice(0, 7);
  const thisMonth = data.claims.filter((c) => c.status === "confirmed" && c.earnedMonth === month);
  const monthCommission = thisMonth.reduce((sum, c) => sum + c.commissionCents, 0);
  const paidToDate = data.payouts.reduce((sum, p) => sum + p.totalCents, 0);
  const paidThisMonth = data.payouts.some((p) => p.periodMonth === month);

  return (
    <div className="min-h-screen bg-bg">
      <header className="bg-brand">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="h-7 w-7 rounded-md bg-white p-1" />
            <span className="text-[15px] font-semibold tracking-[-0.02em] text-white">
              Nexus <span className="text-brand-gold">Sales</span>
            </span>
          </div>
          <form action={repSignOut}>
            <button type="submit" className="text-xs text-white/70 hover:text-white">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        <h1 className="text-[22px] font-semibold tracking-[-0.025em]">Hi, {data.name}</h1>

        <div className="grid gap-3 sm:grid-cols-3">
          <Tile
            label={`${monthLabel(month)} so far`}
            value={formatCentsWhole(data.monthlySalaryCents + monthCommission)}
            hint={
              paidThisMonth
                ? "Paid"
                : data.monthlySalaryCents > 0
                  ? `${formatCentsWhole(data.monthlySalaryCents)} salary + commission`
                  : "Paid out at month end"
            }
          />
          <Tile label="Confirmed sales this month" value={String(thisMonth.length)} />
          <Tile label="Paid to date" value={formatCentsWhole(paidToDate)} />
        </div>

        <section className="rounded-lg border border-edge bg-surface p-4">
          <h2 className="mb-3 text-[13px] font-semibold">Log a customer</h2>
          <RepClaimForm />
          <p className="mt-3 text-xs leading-relaxed text-faint">
            Log customers <strong className="font-medium text-muted">before</strong> they pay (or within{" "}
            {REP_CLAIM_GRACE_DAYS} days after). A sale confirms automatically once they pay on the site:{" "}
            {formatCentsWhole(REP_PLAN_COMMISSION_CENTS.monthly)} monthly,{" "}
            {formatCentsWhole(REP_PLAN_COMMISSION_CENTS.six_month)} 6-month,{" "}
            {formatCentsWhole(REP_PLAN_COMMISSION_CENTS.annual)} annual. Academies earn{" "}
            {Math.round(REP_ACADEMY_CUT * 100)}% of their first payment; junior tours are a flat rate per
            deal.
          </p>
        </section>

        <section className="rounded-lg border border-edge bg-surface p-4">
          <h2 className="mb-1 text-[13px] font-semibold">My customers</h2>
          {data.claims.length === 0 ? (
            <p className="py-6 text-center text-xs text-faint">No customers logged yet.</p>
          ) : (
            <ul>
              {data.claims.map((c) => (
                <li key={c.id} className="flex items-center gap-3 border-t border-edge py-2.5 first:border-t-0">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px]">{c.customerName || c.customerEmail}</span>
                    <span className="block truncate text-xs text-faint">
                      {c.customerName && c.customerEmail ? `${c.customerEmail} · ` : ""}
                      {KIND_LABEL[c.kind]} · {formatDate(c.claimedAt)}
                    </span>
                  </span>
                  <Badge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Badge>
                  <span className="tnum w-14 text-right text-[13px]">
                    {c.status === "confirmed" ? formatCentsWhole(c.commissionCents) : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {data.payouts.length > 0 && (
          <section className="rounded-lg border border-edge bg-surface p-4">
            <h2 className="mb-1 text-[13px] font-semibold">Payouts</h2>
            <ul>
              {data.payouts.map((p) => (
                <li
                  key={p.periodMonth}
                  className="flex items-baseline gap-3 border-t border-edge py-2.5 text-xs first:border-t-0"
                >
                  <span className="flex-1 text-[13px]">{monthLabel(p.periodMonth)}</span>
                  <span className="text-faint">paid {formatDate(p.paidAt)}</span>
                  <span className="tnum w-16 text-right text-[13px] font-medium">
                    {formatCentsWhole(p.totalCents)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
