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
      className="rounded-md bg-brand-gold px-3 py-1.5 text-[13px] font-medium text-brand transition-[filter,opacity] duration-150 hover:brightness-105 active:brightness-95 disabled:pointer-events-none disabled:opacity-60"
      title="Re-fetch Stripe, Anthropic, Instagram, Vercel and user data"
    >
      {isPending ? "Syncing…" : "Sync data"}
    </button>
  );
}
