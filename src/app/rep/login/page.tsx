"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { repSetPassword, repSignIn } from "@/actions/rep";

const LABEL = "mb-1.5 block text-xs text-muted";
const INPUT =
  "w-full rounded-md border border-edge bg-surface-2 px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20";

export default function RepLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"sign_in" | "set_password">("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const settingUp = mode === "set_password";

  function switchMode() {
    setMode(settingUp ? "sign_in" : "set_password");
    setError(null);
    setPassword("");
    setConfirm("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (settingUp && password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const result = settingUp ? await repSetPassword(email, password) : await repSignIn(email, password);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.push("/rep");
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
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
            <p className="mt-2 text-[13px] text-white/60">
              {settingUp ? "First time? Choose a password for your rep email." : "Rep sign-in"}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl bg-surface p-6">
          <div>
            <label htmlFor="email" className={LABEL}>
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor="password" className={LABEL}>
              {settingUp ? "New password (8+ characters)" : "Password"}
            </label>
            <input
              id="password"
              type="password"
              autoComplete={settingUp ? "new-password" : "current-password"}
              required
              minLength={settingUp ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={INPUT}
            />
          </div>
          {settingUp && (
            <div>
              <label htmlFor="confirm" className={LABEL}>
                Confirm password
              </label>
              <input
                id="confirm"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={INPUT}
              />
            </div>
          )}

          {error && <p className="text-xs text-danger">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-brand-gold px-3 py-2 text-sm font-medium text-brand transition-[filter,opacity] duration-150 hover:brightness-105 active:brightness-95 disabled:opacity-50"
          >
            {loading ? "One sec…" : settingUp ? "Set password & sign in" : "Sign in"}
          </button>

          <button
            type="button"
            onClick={switchMode}
            className="w-full text-center text-xs text-muted hover:text-ink"
          >
            {settingUp ? "Already set a password? Sign in" : "First time here? Set your password"}
          </button>
        </form>
      </div>
    </div>
  );
}
