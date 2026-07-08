"use client";

import { useTransition } from "react";
import { syncNow } from "@/actions/sync";

// The transition stays pending until the post-revalidation re-render lands,
// so "syncing…" covers the live Stripe/Anthropic re-fetch, not just the action.
export function SyncButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => syncNow())}
      disabled={isPending}
      className="font-mono text-xs text-faint transition-colors hover:text-gold disabled:pointer-events-none"
      title="Re-fetch Stripe, Anthropic and user data"
    >
      {isPending ? "syncing…" : "[sync]"}
    </button>
  );
}
