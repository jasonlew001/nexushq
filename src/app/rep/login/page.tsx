"use client";

import { useState } from "react";
import { sendRepLoginLink } from "@/actions/rep";

export default function RepLoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await sendRepLoginLink(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand px-6">
      <div className="w-full max-w-sm motion-safe:animate-fade-up">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-12 w-12 rounded-xl bg-white p-1.5" />
          <div>
            <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-white">
              Nexus <span className="text-brand-gold">Sales</span>
            </h1>
            <p className="mt-2 text-[13px] text-white/60">Sign in with your rep email.</p>
          </div>
        </div>

        <div className="rounded-xl bg-surface p-6">
          {sent ? (
            <p className="text-sm text-ink">
              If <span className="break-all font-medium">{email}</span> is on the rep list, a sign-in
              link is on its way. Open it on this device.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-xs text-muted">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-md border border-edge bg-surface-2 px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </div>

              {error && <p className="text-xs text-danger">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-brand-gold px-3 py-2 text-sm font-medium text-brand transition-[filter,opacity] duration-150 hover:brightness-105 active:brightness-95 disabled:opacity-50"
              >
                {loading ? "Sending…" : "Email me a sign-in link"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
