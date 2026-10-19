import { MessageSquareQuote } from "lucide-react";
import { Card, SectionLabel } from "@/components/ui/card";
import { Skeleton, ShellCard } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { getCustomerRows } from "@/lib/data/customers";
import { acqSourceLabel } from "@/components/charts/chart-theme";
import { formatPercent } from "@/lib/format";
import type { AcqSource } from "@/lib/types";

// "How did you hear about us" — the one-question survey on the main site's
// post-payment success card (upgrade-success-survey.tsx -> api/attribution,
// written service-role because the server-managed-columns trigger blocks a
// logged-in user from writing these). Two columns on user_profiles:
// acq_source (the option picked) and acq_source_detail (free text, only
// saved when they pick "other"). NULL for anyone who skipped the card.
//
// This is the same cut as `group by acq_source, acq_source_detail`, except
// the free text is listed under its option instead of splitting the row.
// Distinct from the UTM columns next to it: those are first-touch, captured
// by middleware for ANY visitor; this is self-reported and payer-only.

const ORDER: Exclude<AcqSource, null>[] = [
  "coach_referral",
  "instagram",
  "google_search",
  "friend_teammate",
  "tournament",
  "other",
];

export async function HearAboutUsPanel() {
  const rows = await getCustomerRows();

  const answered = rows.filter((r) => r.acqSource);
  const stillPaying = answered.filter(
    (r) => r.tier === "premium" && (r.status === "active" || r.status === "past_due")
  ).length;

  const counts = new Map<string, number>();
  for (const r of answered) {
    counts.set(r.acqSource!, (counts.get(r.acqSource!) ?? 0) + 1);
  }

  // Free text only exists for "other" — surface it verbatim, as plain text.
  const otherDetails = answered
    .filter((r) => r.acqSourceDetail)
    .map((r) => r.acqSourceDetail!);

  const buckets = ORDER.filter((key) => counts.has(key)).map((key) => ({
    key,
    label: acqSourceLabel(key),
    count: counts.get(key)!,
  }));
  const top = buckets.reduce((m, b) => Math.max(m, b.count), 0);

  return (
    <Card>
      <SectionLabel>How they heard about us</SectionLabel>

      {answered.length === 0 ? (
        <EmptyState
          icon={MessageSquareQuote}
          label="Nobody has answered yet"
          hint="The survey only appears on the success card after someone pays."
        />
      ) : (
        <>
          <div className="space-y-2">
            {buckets
              .slice()
              .sort((a, b) => b.count - a.count)
              .map((b) => (
                <div key={b.key} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 truncate text-xs text-muted">{b.label}</span>
                  <span className="h-2 min-w-[2px] rounded-full bg-accent" style={{ width: `${(b.count / top) * 100}%` }} />
                  <span className="tnum ml-auto shrink-0 text-xs">
                    {b.count}
                    <span className="ml-1.5 text-faint">
                      {formatPercent(b.count / answered.length)}
                    </span>
                  </span>
                </div>
              ))}
          </div>

          {otherDetails.length > 0 && (
            <div className="mt-3 border-t border-edge pt-3">
              <p className="mb-1.5 text-[10px] uppercase tracking-wider text-faint">
                What “other” said
              </p>
              <ul className="space-y-1">
                {otherDetails.map((detail, i) => (
                  <li
                    key={i}
                    className="break-words border-l-2 border-edge pl-2 text-xs leading-relaxed text-muted"
                  >
                    {detail}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="mt-3 text-xs text-faint">
            {answered.length} answered · {stillPaying} still paying. Asked once on the
            post-payment card, so it only covers people who paid — and it is blank for anyone
            who skipped it or paid before the survey shipped. Self-reported, unlike the UTM
            source column.
          </p>
        </>
      )}
    </Card>
  );
}

export function HearAboutUsPanelSkeleton() {
  return (
    <ShellCard className="h-[220px]">
      <Skeleton className="mb-3 h-3 w-44" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    </ShellCard>
  );
}
