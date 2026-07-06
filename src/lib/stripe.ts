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
    // No apiVersion pin: the installed SDK (stripe@22.3.0) validates this
    // string against its own bundled version list at construction time and
    // throws if it doesn't recognize it — pinning to an arbitrary version
    // string (e.g. fairway-mvp's webhook version) isn't safe across SDK
    // releases. Omitting it uses the account's dashboard-configured default
    // (or the key's pinned version), which Stripe keeps behavior-compatible
    // going forward, so no hard-coded string to maintain.
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}
