import Link from "next/link";
import {
  TrendingUp,
  CircleDollarSign,
  Users,
  Receipt,
  Database,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getSignupMetrics } from "@/lib/data/signups";
import { getStripeMetrics } from "@/lib/data/stripe-metrics";
import { getCustomerRows } from "@/lib/data/customers";
import { getAnthropicMetrics } from "@/lib/data/anthropic-metrics";
import { getManualCosts, monthlyBurnCents } from "@/lib/data/costs";
import { getDataFreshness } from "@/lib/data/freshness";
import { formatCentsWhole } from "@/lib/format";

interface SectionCard {
  href: string;
  label: string;
  icon: LucideIcon;
  stat: string;
  detail: string;
}

// The "zoom into detailed stuff" grid — each card is a live-stat teaser for
// a detail page. All fetchers here are already request-cached (cache() /
// unstable_cache), so this costs nothing beyond what the KPI row fetched.
export async function OverviewCards() {
  const [signups, stripe, customers, anthropic, manualCosts, freshness] = await Promise.all([
    getSignupMetrics(),
    getStripeMetrics(),
    getCustomerRows(),
    getAnthropicMetrics(),
    getManualCosts(),
    getDataFreshness(),
  ]);

  const pastDue = customers.filter((c) => c.status === "past_due").length;
  const monthKey = new Date().toISOString().slice(0, 7);
  const burnCents =
    anthropic.data.monthToDateCents + Math.round(monthlyBurnCents(manualCosts, monthKey));
  const oldest = freshness.reduce<number | null>(
    (max, d) => (d.ageDays != null && (max == null || d.ageDays > max) ? d.ageDays : max),
    null
  );

  const cards: SectionCard[] = [
    {
      href: "/growth",
      label: "Growth",
      icon: TrendingUp,
      stat: `${signups.wow.current} this week`,
      detail: `${signups.totalSignups.toLocaleString()} total signups · attribution & states`,
    },
    {
      href: "/revenue",
      label: "Revenue",
      icon: CircleDollarSign,
      stat: `${formatCentsWhole(stripe.data.mrrCents)} MRR`,
      detail: `${stripe.data.payingSubscriberCount} paying · plans & MRR trend`,
    },
    {
      href: "/customers",
      label: "Customers",
      icon: Users,
      stat: `${customers.length.toLocaleString()} accounts`,
      detail:
        pastDue > 0
          ? `${pastDue} past due · search, filter, payment history`
          : "search, filter, payment history",
    },
    {
      href: "/costs",
      label: "Costs",
      icon: Receipt,
      stat: `${formatCentsWhole(burnCents)} burn MTD`,
      detail: "Anthropic API spend + fixed costs",
    },
    {
      href: "/data",
      label: "Data health",
      icon: Database,
      stat: oldest != null ? `oldest update ${oldest}d ago` : "no timestamps yet",
      detail: `${freshness.length} product datasets · coaches, players, rankings`,
    },
  ];

  return (
    <Card className="p-0">
      <div className="border-b border-edge px-4 py-3">
        <p className="text-sm font-medium">Sections</p>
      </div>
      <div className="stagger divide-y divide-edge">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
          >
            <span className="shrink-0 rounded-md bg-surface-2 p-1.5 transition-colors group-hover:bg-accent/10">
              <card.icon className="h-4 w-4 text-muted transition-colors group-hover:text-accent" strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{card.label}</p>
              <p className="truncate text-xs text-faint">{card.detail}</p>
            </div>
            <p className="tnum shrink-0 text-sm text-accent">{card.stat}</p>
            <ChevronRight className="h-4 w-4 shrink-0 text-faint opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
        ))}
      </div>
    </Card>
  );
}

export function OverviewCardsSkeleton() {
  return (
    <Card className="p-0">
      <div className="border-b border-edge px-4 py-3">
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="divide-y divide-edge">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-7 w-7 rounded-md" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </Card>
  );
}
