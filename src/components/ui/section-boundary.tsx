"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

// Why a boundary instead of returning zeroed data: for cost/usage figures a
// degraded "—" is fine (see anthropic-metrics), but MRR, subscriber counts
// and signup dates must never render a plausible wrong number. $0 MRR reads
// as "we lost everyone", not "Stripe is down". So a failing section says so
// and the rest of the page keeps working.
//
// Placed OUTSIDE each <Suspense> so it also catches throws during streaming.
interface Props {
  label: string;
  children: ReactNode;
}

export class SectionBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // Server component errors arrive here already digest-ified in prod; the
    // real stack is in the server logs.
    console.error(`Section "${this.props.label}" failed to render`, error);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <div className="rounded-lg border border-edge bg-surface p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="flex items-start gap-2.5">
          <span className="mt-px shrink-0 rounded-md bg-warn/10 p-1.5">
            <AlertTriangle className="h-4 w-4 text-warn" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium">{this.props.label} didn&apos;t load</p>
            <p className="mt-0.5 text-xs text-faint">
              An upstream API failed. Everything else on this page is live — try Sync data, or
              reload in a minute.
            </p>
          </div>
        </div>
      </div>
    );
  }
}
