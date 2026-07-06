import { Card } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/skeleton";
import { getSignupMetrics } from "@/lib/data/signups";
import { formatPercent } from "@/lib/format";

function KpiCard({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta?: { pct: number | null; goodDirection?: "up" | "down" };
}) {
  const deltaTone =
    delta?.pct == null
      ? "text-faint"
      : delta.pct >= 0
        ? "text-accent"
        : "text-danger";
  const deltaSign = delta?.pct != null && delta.pct >= 0 ? "+" : "";

  return (
    <Card>
      <p className="mb-1.5 text-[11px] uppercase tracking-wider text-muted">{label}</p>
      <p className="tnum text-2xl font-semibold leading-none">{value}</p>
      {delta && (
        <p className={`tnum mt-1.5 text-xs ${deltaTone}`}>
          {delta.pct == null ? "—" : `${deltaSign}${formatPercent(delta.pct)} WoW`}
        </p>
      )}
    </Card>
  );
}

// MRR / paying-subs-by-plan need Stripe pricing (not in the DB) — those
// cards render as pending placeholders here and go live in Phase 5.
function PendingKpiCard({ label }: { label: string }) {
  return (
    <Card>
      <p className="mb-1.5 text-[11px] uppercase tracking-wider text-muted">{label}</p>
      <p className="text-sm text-faint">Pending Stripe integration</p>
    </Card>
  );
}

export async function KpiRow() {
  const metrics = await getSignupMetrics();

  return (
    <section className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <PendingKpiCard label="MRR" />
      <PendingKpiCard label="Paying subscribers" />
      <KpiCard label="Total signups" value={metrics.totalSignups.toLocaleString()} />
      <KpiCard
        label="Signup → paid"
        value={formatPercent(metrics.signupToPaidConversion)}
      />
      <KpiCard
        label="Signups this week"
        value={metrics.wow.current.toLocaleString()}
        delta={{ pct: metrics.wow.deltaPct }}
      />
    </section>
  );
}

export function KpiRowSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
