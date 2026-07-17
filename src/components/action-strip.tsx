import { AlertTriangle, Clock, UserPlus, DollarSign, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getCustomerRows } from "@/lib/data/customers";
import { getStripeMetrics } from "@/lib/data/stripe-metrics";
import { getAnthropicMetrics } from "@/lib/data/anthropic-metrics";
import { startOfWeekUTC, formatCentsWhole } from "@/lib/format";
import { ANTHROPIC_MONTHLY_SPEND_ALERT_USD } from "@/lib/constants";

interface ActionItem {
  key: string;
  icon: typeof AlertTriangle;
  tone: "danger" | "warn" | "neutral";
  label: string;
  detail: string;
}

export async function ActionStrip() {
  const [rows, stripe, anthropic] = await Promise.all([
    getCustomerRows(),
    getStripeMetrics(),
    getAnthropicMetrics(),
  ]);

  const pastDue = rows.filter((r) => r.status === "past_due");
  const thisWeekStart = startOfWeekUTC(new Date());
  const newThisWeek = rows.filter((r) => startOfWeekUTC(new Date(r.signedUpAt)) === thisWeekStart);
  const cancelingSoon = stripe.data.cancelingSoon;
  const anthropicMtdUsd = anthropic.data.monthToDateCents / 100;

  const items: ActionItem[] = [];

  if (pastDue.length > 0) {
    items.push({
      key: "past-due",
      icon: AlertTriangle,
      tone: "danger",
      label: `${pastDue.length} payment${pastDue.length === 1 ? "" : "s"} past due`,
      detail: pastDue
        .slice(0, 3)
        .map((r) => r.name)
        .join(", "),
    });
  }

  if (newThisWeek.length > 0) {
    const withSource = newThisWeek.filter((r) => r.utmSource).length;
    items.push({
      key: "new-signups",
      icon: UserPlus,
      tone: "neutral",
      label: `${newThisWeek.length} new signup${newThisWeek.length === 1 ? "" : "s"} this week`,
      detail: withSource > 0 ? `${withSource} with attribution` : "no attribution data",
    });
  }

  if (cancelingSoon.length > 0) {
    items.push({
      key: "canceling",
      icon: Clock,
      tone: "warn",
      label: `${cancelingSoon.length} subscription${cancelingSoon.length === 1 ? "" : "s"} canceling soon`,
      detail: "within 14 days",
    });
  }

  if (anthropicMtdUsd >= ANTHROPIC_MONTHLY_SPEND_ALERT_USD) {
    items.push({
      key: "anthropic-spend",
      icon: DollarSign,
      tone: "warn",
      label: `Anthropic spend trending above $${ANTHROPIC_MONTHLY_SPEND_ALERT_USD}`,
      detail: `${formatCentsWhole(anthropic.data.monthToDateCents)} month-to-date`,
    });
  }

  const TONE_TEXT = {
    danger: "text-danger",
    warn: "text-warn",
    neutral: "text-ink",
  } as const;
  const TONE_TILE = {
    danger: "bg-danger/10 text-danger",
    warn: "bg-warn/10 text-warn",
    neutral: "bg-surface-2 text-muted",
  } as const;

  if (items.length === 0) {
    return (
      <Card className="flex items-center gap-2.5">
        <span className="rounded-md bg-accent/10 p-1.5">
          <CheckCircle2 className="h-4 w-4 text-accent" strokeWidth={1.75} />
        </span>
        <span className="text-sm text-muted">All clear — no action items.</span>
      </Card>
    );
  }

  return (
    <Card className="p-0">
      <div className="border-b border-edge px-4 py-3">
        <p className="text-sm font-medium">Needs attention</p>
      </div>
      <div className="stagger divide-y divide-edge">
        {items.map((item) => (
          <div key={item.key} className="flex items-start gap-2.5 px-4 py-3">
            <span className={`shrink-0 rounded-md p-1.5 ${TONE_TILE[item.tone]}`}>
              <item.icon className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <p className={`text-sm font-medium ${TONE_TEXT[item.tone]}`}>{item.label}</p>
              <p className="truncate text-xs text-faint">{item.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function ActionStripSkeleton() {
  return (
    <Card className="p-0">
      <div className="border-b border-edge px-4 py-3">
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="divide-y divide-edge">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2.5 px-4 py-3">
            <Skeleton className="h-7 w-7 rounded-md" />
            <Skeleton className="h-4 w-40" />
          </div>
        ))}
      </div>
    </Card>
  );
}
