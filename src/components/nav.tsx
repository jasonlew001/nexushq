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
    ],
  },
  {
    label: "Manage",
    links: [
      { href: "/requests", label: "Requests", icon: Inbox },
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
        "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] transition-colors",
        active
          ? "border border-edge bg-surface font-medium text-ink shadow-[0_1px_2px_rgba(16,24,40,0.06)]"
          : "border border-transparent text-muted hover:bg-surface/60 hover:text-ink"
      )}
    >
      <link.icon className={cn("h-4 w-4", active ? "text-accent" : "text-muted")} strokeWidth={1.75} />
      {link.label}
      {badge > 0 ? <CountPill count={badge} /> : null}
    </Link>
  );
}

// The sidebar rail's vertical nav — grouped ANALYZE / MANAGE, Fieldra-style.
export function SidebarNav({ newRequestCount = 0 }: { newRequestCount?: number }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-5">
      {GROUPS.map((group) => (
        <div key={group.label}>
          <p className="mb-1 px-3 text-[11px] font-medium uppercase tracking-wider text-faint">
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
