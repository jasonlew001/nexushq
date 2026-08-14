import { formatPercent } from "@/lib/format";

// Two-row bar funnel: signups (full track) -> paying (filled to the real
// conversion fraction). Generic on `paying`'s source — the Overview caller
// passes stripeMetrics.payingSubscriberCount specifically so this always
// matches the "Paying subscribers" KPI card above it (both read Stripe's
// live state, not the DB's webhook-replicated copy).
export function SignupFunnel({ signups, paying }: { signups: number; paying: number }) {
  const pct = signups > 0 ? paying / signups : 0;
  const free = Math.max(signups - paying, 0);

  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1 flex items-center justify-between text-[11px] text-muted">
          <span>SIGNUPS</span>
          <span className="tnum text-ink">{signups.toLocaleString()}</span>
        </div>
        <div className="h-2 w-full rounded-full bg-accent/70" />
      </div>

      <p className="text-center text-[10px] uppercase tracking-wide text-faint">
        converts at {formatPercent(pct)}
      </p>

      <div>
        <div className="mb-1 flex items-center justify-between text-[11px] text-muted">
          <span>PAYING</span>
          <span className="tnum text-ink">{paying.toLocaleString()}</span>
        </div>
        <div className="h-2 w-full rounded-full bg-surface-2">
          <div
            className="h-2 rounded-full bg-accent"
            style={{ width: `${Math.min(pct * 100, 100)}%` }}
          />
        </div>
      </div>

      <p className="text-[11px] text-faint">
        {free.toLocaleString()} free · room to convert
      </p>
    </div>
  );
}
