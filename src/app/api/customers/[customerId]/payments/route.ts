import { NextResponse } from "next/server";
import { requireFounder } from "@/lib/auth";
import { getAllProfiles } from "@/lib/data/profiles";
import { getStripe } from "@/lib/stripe";

export interface PaymentRecord {
  id: string;
  date: string;
  description: string;
  amountCents: number;
  status: string;
  invoiceUrl: string | null;
}

// GET-semantics, no-store, on-demand — not cached, unlike everything else
// in the data layer. Re-checks requireFounder() (route handlers aren't
// covered by middleware's session gate — see src/middleware.ts matcher).
export async function GET(
  _request: Request,
  { params }: { params: { customerId: string } }
) {
  await requireFounder();

  const { customerId } = params;

  // Don't trust the path param as an arbitrary Stripe customer ID — only
  // proxy invoices for a customer ID that actually belongs to one of our
  // profiles. Prevents using HQ as a lookup service for unrelated Stripe
  // customers under the same account.
  const profiles = await getAllProfiles();
  const match = profiles.find((p) => p.stripe_customer_id === customerId);
  if (!match) {
    return new Response(null, { status: 404 });
  }

  const stripe = getStripe();
  const invoices: PaymentRecord[] = [];

  for await (const invoice of stripe.invoices.list({ customer: customerId, limit: 100 })) {
    invoices.push({
      id: invoice.id ?? "",
      date: new Date(invoice.created * 1000).toISOString(),
      description: invoice.lines.data[0]?.description ?? invoice.description ?? "Invoice",
      amountCents: invoice.amount_paid,
      status: invoice.status ?? "unknown",
      invoiceUrl: invoice.hosted_invoice_url ?? null,
    });
  }

  return NextResponse.json({ invoices });
}
