import Link from "next/link";
import {
  TrendingUp,
  CircleDollarSign,
  Users,
  Receipt,
  Database,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
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
    <section className="stagger grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <Link
          key={card.href}
          href={card.href}
          className="group relative rounded-lg border border-edge bg-surface p-4 transition-all duration-150 hover:-translate-y-0.5 hover:border-edge-strong hover:shadow-sm"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="rounded-md bg-surface-2 p-2 transition-colors group-hover:bg-accent/10">
              <card.icon className="h-4 w-4 text-muted transition-colors group-hover:text-accent" strokeWidth={1.5} />
            </span>
            <ArrowUpRight className="h-4 w-4 text-faint opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:opacity-100" />
          </div>
          <p className="text-sm font-medium">{card.label}</p>
          <p className="tnum mt-0.5 font-mono text-sm text-accent">{card.stat}</p>
          <p className="mt-1 text-xs text-faint">{card.detail}</p>
        </Link>
      ))}
    </section>
  );
}

export function OverviewCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-32 w-full rounded-lg" />
      ))}
    </div>
  );
}
