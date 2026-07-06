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

  if (items.length === 0) {
    return (
      <Card className="flex items-center gap-2 !py-2.5">
        <CheckCircle2 className="h-4 w-4 text-accent" strokeWidth={1.5} />
        <span className="text-sm text-muted">All clear — no action items.</span>
      </Card>
    );
  }

  const TONE_TEXT = {
    danger: "text-danger",
    warn: "text-warn",
    neutral: "text-ink",
  } as const;

  return (
    <div className="stagger grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <Card key={item.key} className="flex items-start gap-2.5">
          <item.icon
            className={`mt-0.5 h-4 w-4 shrink-0 ${TONE_TEXT[item.tone]}`}
            strokeWidth={1.5}
          />
          <div className="min-w-0">
            <p className={`text-sm font-medium ${TONE_TEXT[item.tone]}`}>{item.label}</p>
            <p className="truncate text-xs text-faint">{item.detail}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}

export function ActionStripSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="flex items-center gap-2.5">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </Card>
      ))}
    </div>
  );
}
