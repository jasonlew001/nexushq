"use client";

import { useEffect, useState } from "react";
import { X, CreditCard, ExternalLink } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCentsPrecise, formatDate } from "@/lib/format";
import type { CustomerRow } from "@/lib/types";
import type { PaymentRecord } from "@/app/api/customers/[customerId]/payments/route";

export function CustomerDetailPanel({
  customer,
  onClose,
}: {
  customer: CustomerRow;
  onClose: () => void;
}) {
  const [payments, setPayments] = useState<PaymentRecord[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!customer.stripeCustomerId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/customers/${customer.stripeCustomerId}/payments`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load payment history");
        return res.json();
      })
      .then((data: { invoices: PaymentRecord[] }) => {
        if (!cancelled) setPayments(data.invoices);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [customer.stripeCustomerId]);

  return (
    <div className="fixed inset-0 z-50 motion-safe:animate-fade-in">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto border-l border-edge bg-surface p-5 motion-safe:animate-slide-in-right">
        <div className="mb-4 flex items-start justify-between">
          <div>
            {/* Escaped by default via JSX — no dangerouslySetInnerHTML anywhere */}
            <h2 className="text-base font-semibold">{customer.name}</h2>
            <p className="text-xs text-muted">{customer.email ?? "—"}</p>
          </div>
          <button onClick={onClose} className="text-faint hover:text-ink" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-faint">Signed up</p>
            <p className="mt-0.5">{formatDate(customer.signedUpAt)}</p>
          </div>
          <div>
            <p className="text-faint">Location</p>
            <p className="mt-0.5">{customer.cityState || "—"}</p>
          </div>
          <div>
            <p className="text-faint">Tier</p>
            <p className="mt-0.5 capitalize">{customer.tier ?? "free"}</p>
          </div>
          <div>
            <p className="text-faint">Status</p>
            <p className="mt-0.5 capitalize">{customer.status ?? "—"}</p>
          </div>
          <div>
            <p className="text-faint">UTM source</p>
            <p className="mt-0.5">
              {customer.isPreTracking ? (
                <Badge tone="neutral">no attribution data</Badge>
              ) : (
                customer.utmSource || "—"
              )}
            </p>
          </div>
          <div>
            <p className="text-faint">Heard about us</p>
            <p className="mt-0.5">{customer.acqSource || "—"}</p>
          </div>
        </div>

        <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted">
          Payment history
        </h3>

        {!customer.stripeCustomerId ? (
          <EmptyState icon={CreditCard} label="Never a Stripe customer" />
        ) : loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : error ? (
          <p className="text-xs text-danger">{error}</p>
        ) : payments && payments.length === 0 ? (
          <EmptyState icon={CreditCard} label="No payment history" />
        ) : (
          <div className="divide-y divide-edge">
            {payments?.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                <div className="min-w-0">
                  <p className="truncate">{p.description}</p>
                  <p className="text-faint">{formatDate(p.date)} · {p.status}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="tnum">{formatCentsPrecise(p.amountCents)}</span>
                  {p.invoiceUrl && (
                    <a href={p.invoiceUrl} target="_blank" rel="noreferrer" className="text-faint hover:text-accent">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
