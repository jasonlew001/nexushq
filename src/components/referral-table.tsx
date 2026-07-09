import { Ticket } from "lucide-react";
import { Card, SectionLabel } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { getReferralStats } from "@/lib/data/referrals";
import { formatCentsPrecise } from "@/lib/format";
import { COACH_REFERRAL_CUT } from "@/lib/constants";

// Per-coach referral code performance, straight from Stripe: promotion
// codes x paid invoices. A customer is credited to the code on their
// earliest promo-bearing paid invoice; the coach's cut is
// COACH_REFERRAL_CUT of that first payment.
export async function ReferralTable() {
  const { data: codes } = await getReferralStats();

  return (
    <Card>
      <SectionLabel>Coach referral codes</SectionLabel>

      {codes.length === 0 ? (
        <EmptyState
          icon={Ticket}
          label="No promotion codes in Stripe yet"
          hint="Create a promo code per coach in the Stripe Dashboard and it'll show up here"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-edge">
                <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted">
                  Code
                </th>
                <th className="tnum px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wider text-muted">
                  Redemptions
                </th>
                <th className="tnum px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wider text-muted">
                  Paying customers
                </th>
                <th className="tnum px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wider text-muted">
                  First-purchase rev
                </th>
                <th className="tnum px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wider text-muted">
                  Coach cut ({Math.round(COACH_REFERRAL_CUT * 100)}%)
                </th>
                <th className="tnum px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wider text-muted">
                  Referred rev (lifetime)
                </th>
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => (
                <tr key={c.code} className="border-b border-edge transition-colors hover:bg-surface-2">
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2">
                      <span className="font-mono font-medium">{c.code}</span>
                      {!c.active && <Badge tone="neutral">inactive</Badge>}
                    </span>
                  </td>
                  <td className="tnum px-3 py-2 text-right font-mono">{c.timesRedeemed}</td>
                  <td className="tnum px-3 py-2 text-right font-mono">{c.customerCount}</td>
                  <td className="tnum px-3 py-2 text-right font-mono">
                    {formatCentsPrecise(c.firstPurchaseCents)}
                  </td>
                  <td className="tnum px-3 py-2 text-right font-mono text-gold">
                    {formatCentsPrecise(c.coachCutCents)}
                  </td>
                  <td className="tnum px-3 py-2 text-right font-mono">
                    {formatCentsPrecise(c.referredLifetimeCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-faint">
        &ldquo;Redemptions&rdquo; is Stripe&apos;s counter (includes non-paying uses);
        &ldquo;paying customers&rdquo; credits a customer to the code on their first
        promo-bearing paid invoice. Coach cut is {Math.round(COACH_REFERRAL_CUT * 100)}% of
        those first payments.
      </p>
    </Card>
  );
}

export function ReferralTableSkeleton() {
  return (
    <div className="rounded-lg border border-edge bg-surface p-4">
      <Skeleton className="mb-3 h-3 w-36" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
