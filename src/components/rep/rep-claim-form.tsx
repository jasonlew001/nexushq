"use client";

import { useState, useTransition } from "react";
import { submitRepClaim } from "@/actions/rep";
import { SALES_CLAIM_KINDS, type SalesClaimKind } from "@/lib/constants";

const LABEL = "mb-1.5 block text-xs text-muted";
const INPUT =
  "w-full rounded-md border border-edge bg-surface-2 px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20";

const KIND_LABEL: Record<SalesClaimKind, string> = {
  individual: "Individual player",
  academy: "Academy",
  tour: "Junior tour",
};

export function RepClaimForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [kind, setKind] = useState<SalesClaimKind>("individual");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitted(null);
    if (!email.trim() && name.trim().length < 2) {
      setError("Enter their email, or their full name if you don't know it.");
      return;
    }
    startTransition(async () => {
      try {
        await submitRepClaim({
          customerEmail: email || null,
          customerName: name || null,
          customerPhone: phone || null,
          kind,
          note: note || null,
        });
        setSubmitted(name.trim() || email);
        setEmail("");
        setName("");
        setPhone("");
        setNote("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't submit that customer");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="claim-name" className={LABEL}>
          Customer&apos;s full name
        </label>
        <input
          id="claim-name"
          maxLength={100}
          autoComplete="off"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="First and last name"
          className={INPUT}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="claim-email" className={LABEL}>
            Email <span className="text-faint">(if you know it)</span>
          </label>
          <input
            id="claim-email"
            type="email"
            maxLength={254}
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor="claim-phone" className={LABEL}>
            Phone <span className="text-faint">(optional)</span>
          </label>
          <input
            id="claim-phone"
            type="tel"
            maxLength={30}
            autoComplete="off"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={INPUT}
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="claim-kind" className={LABEL}>
            Type
          </label>
          <select
            id="claim-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as SalesClaimKind)}
            className={INPUT}
          >
            {SALES_CLAIM_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="claim-note" className={LABEL}>
            Note <span className="text-faint">(optional)</span>
          </label>
          <input
            id="claim-note"
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. met at the Dallas junior open"
            className={INPUT}
          />
        </div>
      </div>
      <p className="text-xs text-faint">
        Name, email, or both. If you don&apos;t know the email they&apos;ll sign up with, the name (and phone, if you
        have it) is enough. Nexus matches it up.
      </p>

      {error && <p className="text-xs text-danger">{error}</p>}
      {submitted && (
        <p className="break-all text-xs text-accent">Submitted {submitted}. It shows below as pending.</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-brand-gold px-3 py-2 text-sm font-medium text-brand transition-[filter,opacity] duration-150 hover:brightness-105 active:brightness-95 disabled:opacity-50 sm:w-auto sm:px-5"
      >
        {isPending ? "Submitting…" : "Submit customer"}
      </button>
    </form>
  );
}
