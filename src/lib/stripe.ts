import Stripe from "stripe";

if (typeof window !== "undefined") {
  throw new Error("stripe.ts must never be imported client-side");
}

let stripeClient: Stripe | undefined;

// LIVE mode key only — never the main repo's TEST .env.local value.
export function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
    // Pinned to match fairway-mvp's webhook (scripts/add-stripe-columns.sql /
    // the main repo's webhook route) so both apps read the same response
    // shape. The installed SDK's types only know its own bundled "latest"
    // version literal — the API itself accepts any version string a
    // Stripe account has been pinned to, hence the cast.
    stripeClient = new Stripe(key, { apiVersion: "2025-09-30.basil" as never });
  }
  return stripeClient;
}
