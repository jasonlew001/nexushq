"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  CircleDollarSign,
  Users,
  Receipt,
  Database,
  Instagram,
  Inbox,
  Lightbulb,
  Globe,
  Handshake,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

// Unread-style count rendered as a red pill. Only the Requests row uses one
// today, so the nav takes a single count rather than a generic badge map.
function CountPill({ count, compact = false }: { count: number; compact?: boolean }) {
  return (
    <span
      aria-label={`${count} unhandled`}
      className={cn(
        "tnum ml-auto inline-flex items-center justify-center rounded-full bg-danger font-semibold text-white",
        compact ? "h-4 min-w-4 px-1 text-[10px]" : "h-[18px] min-w-[18px] px-1.5 text-[10px]"
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

interface NavGroup {
  label: string;
  links: readonly NavLink[];
}

const GROUPS: readonly NavGroup[] = [
  {
    label: "Analyze",
    links: [
      { href: "/", label: "Overview", icon: LayoutDashboard },
      { href: "/growth", label: "Growth", icon: TrendingUp },
      { href: "/revenue", label: "Revenue", icon: CircleDollarSign },
      { href: "/customers", label: "Customers", icon: Users },
      { href: "/social", label: "Social", icon: Instagram },
      { href: "/inspiration", label: "Inspiration", icon: Lightbulb },
    ],
  },
  {
    label: "Operate",
    links: [
      { href: "/site", label: "Site", icon: Globe },
      { href: "/requests", label: "Requests", icon: Inbox },
      { href: "/sales", label: "Sales", icon: Handshake },
      { href: "/costs", label: "Costs", icon: Receipt },
      { href: "/data", label: "Data", icon: Database },
    ],
  },
] as const;

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function NavItem({ link, active, badge }: { link: NavLink; active: boolean; badge: number }) {
  return (
    <Link
      href={link.href}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-3 py-[7px] text-[13px] transition-colors duration-150",
        active ? "bg-white/[0.09] font-medium text-white" : "text-white/65 hover:bg-white/[0.05] hover:text-white"
      )}
    >
      <link.icon
        className={cn("h-4 w-4 transition-colors", active ? "text-brand-gold" : "text-white/45")}
        strokeWidth={1.75}
      />
      {link.label}
      {badge > 0 ? <CountPill count={badge} /> : null}
    </Link>
  );
}

// The sidebar rail's vertical nav, grouped Analyze / Operate.
export function SidebarNav({ newRequestCount = 0 }: { newRequestCount?: number }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-5">
      {GROUPS.map((group) => (
        <div key={group.label}>
          <p className="mb-1.5 px-3 text-xs text-white/50">
            {group.label}
          </p>
          <div className="flex flex-col gap-0.5">
            {group.links.map((link) => (
              <NavItem
                key={link.href}
                link={link}
                active={isActive(pathname, link.href)}
                badge={link.href === "/requests" ? newRequestCount : 0}
              />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

// Flattened single-row variant for the mobile top bar (sidebar hidden below md).
export function MobileNav({ newRequestCount = 0 }: { newRequestCount?: number }) {
  const pathname = usePathname();
  const links = GROUPS.flatMap((g) => g.links);

  return (
    <nav className="flex items-center gap-1 overflow-x-auto">
      {links.map((link) => {
        const active = isActive(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs transition-colors",
              active ? "bg-surface-2 font-medium text-ink" : "text-muted hover:text-ink"
            )}
          >
            <link.icon className={cn("h-3.5 w-3.5", active ? "text-accent" : "text-muted")} strokeWidth={1.75} />
            {link.label}
            {link.href === "/requests" && newRequestCount > 0 ? (
              <CountPill count={newRequestCount} compact />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
