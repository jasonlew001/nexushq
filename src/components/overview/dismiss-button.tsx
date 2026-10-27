"use client";

import { useFormStatus } from "react-dom";
import { X } from "lucide-react";

// Submit button for the attention strip's dismiss form. aria-busy while the
// action runs lets the parent <li> fade itself (has-[…]) before the
// revalidated page arrives, so the click registers instantly.
export function DismissButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      title="Dismiss until something changes"
      aria-label={`Dismiss: ${label}`}
      className="rounded-md p-1 text-faint transition-opacity hover:bg-edge/60 hover:text-ink focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
    >
      <X className="h-3.5 w-3.5" strokeWidth={2} />
    </button>
  );
}
