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
      className="rounded-md bg-ink px-3.5 py-2 text-[13px] font-medium text-surface transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-60"
      title="Re-fetch Stripe, Anthropic and user data"
    >
      {isPending ? "Syncing…" : "Sync data"}
    </button>
  );
}
