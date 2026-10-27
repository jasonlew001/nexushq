import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getContactRequests } from "@/lib/data/requests";
import { getCustomerRows } from "@/lib/data/customers";
import { getStripeMetrics } from "@/lib/data/stripe-metrics";
import { getAnthropicMetrics } from "@/lib/data/anthropic-metrics";
import { getVercelDeploys, getVercelErrors, FAILED_STATES } from "@/lib/data/vercel-metrics";
import { formatCentsWhole, formatRelativeTime } from "@/lib/format";
import { ANTHROPIC_MONTHLY_SPEND_ALERT_USD, CANCELING_SOON_WINDOW_DAYS } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { fingerprint, readDismissed } from "@/lib/attention";
import { dismissAttention, restoreAttention } from "@/actions/attention";
import { DismissButton } from "./dismiss-button";

interface Item {
  key: string;
  tone: "danger" | "warn";
  label: string;
  detail: string;
  href: string;
  // What the item is showing right now; a dismissal holds only while this matches.
  fingerprint: string;
}

// "Who did we not name": profiles with no first/last name come back as "—"
// from getCustomerRows; listing them as "—, —" said nothing. Name who we
// can, count the rest.
function describePeople(names: string[], max = 2): string {
  const named = names.filter((n) => n && n !== "—");
  const unnamed = names.length - named.length;
  const shown = named.slice(0, max);
  const rest = named.length - shown.length + unnamed;
  if (shown.length === 0) return `${unnamed} without a name on file`;
  return rest > 0 ? `${shown.join(", ")} and ${rest} more` : shown.join(", ");
}

// Everything on Overview that wants a human, in one place: unanswered
// requests, failed payments, a push that didn't ship, production errors
// today, upcoming cancellations, runaway AI spend. Collapses to one calm
// line when there is nothing to do.
export async function AttentionStrip() {
  const [{ requests }, rows, stripe, anthropic, deploys, errors] = await Promise.all([
    getContactRequests(),
    getCustomerRows(),
    getStripeMetrics(),
    getAnthropicMetrics(),
    getVercelDeploys(),
    getVercelErrors(),
  ]);

  const items: Item[] = [];

  const unanswered = requests.filter((r) => r.status === "new");
  if (unanswered.length > 0) {
    items.push({
      key: "requests",
      tone: "danger",
      label: `${unanswered.length} unanswered request${unanswered.length === 1 ? "" : "s"}`,
      detail: `newest ${formatRelativeTime(unanswered[0].createdAt)}`,
      href: "/requests",
      fingerprint: fingerprint(...unanswered.map((r) => r.id).sort()),
    });
  }

  const pastDue = rows.filter((r) => r.status === "past_due");
  if (pastDue.length > 0) {
    items.push({
      key: "past-due",
      tone: "danger",
      label: `${pastDue.length} payment${pastDue.length === 1 ? "" : "s"} past due`,
      detail: describePeople(pastDue.map((r) => r.name)),
      href: "/customers",
      fingerprint: fingerprint(...pastDue.map((r) => r.id).sort()),
    });
  }

  const pending = deploys.data.pending;
  if (pending && FAILED_STATES.has(pending.state)) {
    items.push({
      key: "deploy",
      tone: "danger",
      label: pending.state === "ERROR" ? "Newest push failed to build" : `Newest push ${pending.state.toLowerCase()}`,
      detail: `${pending.sha ?? "deploy"} · ${pending.errorMessage ?? pending.message ?? "see Vercel"}`,
      href: "/site",
      fingerprint: fingerprint(pending.id, pending.state),
    });
  }

  if (!errors.data.error && errors.data.errorsToday > 0) {
    const worst = errors.data.routes.find((r) => r.daily.at(-1));
    items.push({
      key: "errors",
      tone: "warn",
      label: `${errors.data.errorsToday} server error${errors.data.errorsToday === 1 ? "" : "s"} today`,
      detail: worst ? `mostly ${worst.route}` : "production 5xx",
      href: "/site",
      // Today's count: another error after dismissing brings it back.
      fingerprint: fingerprint(new Date().toISOString().slice(0, 10), errors.data.errorsToday),
    });
  }

  const canceling = stripe.data.cancelingSoon;
  if (canceling.length > 0) {
    items.push({
      key: "canceling",
      tone: "warn",
      label: `${canceling.length} subscription${canceling.length === 1 ? "" : "s"} canceling`,
      detail: `within ${CANCELING_SOON_WINDOW_DAYS} days`,
      href: "/revenue",
      fingerprint: fingerprint(...canceling.map((c) => c.subscriptionId).sort()),
    });
  }

  if (anthropic.data.monthToDateCents / 100 >= ANTHROPIC_MONTHLY_SPEND_ALERT_USD) {
    items.push({
      key: "anthropic",
      tone: "warn",
      label: `Anthropic spend over $${ANTHROPIC_MONTHLY_SPEND_ALERT_USD}`,
      detail: `${formatCentsWhole(anthropic.data.monthToDateCents)} this month`,
      href: "/costs",
      fingerprint: fingerprint(new Date().toISOString().slice(0, 7)), // once per month
    });
  }

  const dismissed = readDismissed();
  const visible = items.filter((i) => dismissed[i.key] !== i.fingerprint);
  const hidden = items.length - visible.length;

  const restore =
    hidden > 0 ? (
      <form action={restoreAttention} className="inline">
        <button type="submit" className="text-xs text-faint underline-offset-2 hover:text-ink hover:underline">
          {hidden} dismissed · show
        </button>
      </form>
    ) : null;

  if (visible.length === 0) {
    return (
      <Card className="flex flex-wrap items-center gap-x-2.5 gap-y-1 py-3">
        <CheckCircle2 className="h-4 w-4 text-accent" strokeWidth={1.75} />
        <span className="text-sm">All clear.</span>
        <span className="text-xs text-faint">
          {hidden > 0 ? "Nothing new since you last cleared this." : "Requests answered, payments current, site shipping."}
        </span>
        {restore && <span className="ml-auto">{restore}</span>}
      </Card>
    );
  }

  const dangers = visible.filter((i) => i.tone === "danger").length;

  return (
    <Card className="p-0">
      <div className="flex items-baseline justify-between gap-3 border-b border-edge px-4 py-3">
        <h2 className="text-sm font-medium">Needs attention</h2>
        <p className="text-xs text-faint">
          {visible.length} item{visible.length === 1 ? "" : "s"}
          {dangers > 0 ? ` · ${dangers} urgent` : ""}
          {restore && <> · {restore}</>}
        </p>
      </div>
      {/* Each cell draws its own top/left hairline; the wrapper clips the
          outer ones, so any item count tiles cleanly at any column count. */}
      <div className="overflow-hidden">
      <ul className="stagger -ml-px -mt-px flex flex-wrap">
        {visible.map((item) => (
          <li
            key={item.key}
            className="group relative w-full border-l border-t border-edge transition-opacity has-[[aria-busy=true]]:pointer-events-none has-[[aria-busy=true]]:opacity-30 sm:w-1/2 lg:w-1/3"
          >
            <Link href={item.href} className="flex items-start gap-2.5 py-3 pl-4 pr-10 transition-colors hover:bg-surface-2">
              <span
                className={cn(
                  "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                  item.tone === "danger" ? "bg-danger" : "bg-warn"
                )}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className={cn("block text-sm font-medium", item.tone === "danger" ? "text-danger" : "text-warn")}>
                  {item.label}
                </span>
                <span className="block truncate text-xs text-faint">{item.detail}</span>
              </span>
            </Link>
            {/* Hides the item until what it shows changes (see fingerprint). */}
            <form action={dismissAttention.bind(null, item.key, item.fingerprint)} className="absolute right-2 top-2.5">
              <DismissButton label={item.label} />
            </form>
          </li>
        ))}
      </ul>
      </div>
    </Card>
  );
}

export function AttentionStripSkeleton() {
  return (
    <Card className="p-0">
      <div className="border-b border-edge px-4 py-3">
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    </Card>
  );
}
