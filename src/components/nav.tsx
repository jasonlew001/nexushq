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
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
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
    ],
  },
  {
    label: "Manage",
    links: [
      { href: "/costs", label: "Costs", icon: Receipt },
      { href: "/data", label: "Data", icon: Database },
    ],
  },
] as const;

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function NavItem({ link, active }: { link: NavLink; active: boolean }) {
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
    </Link>
  );
}

// The sidebar rail's vertical nav — grouped ANALYZE / MANAGE, Fieldra-style.
export function SidebarNav() {
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
              <NavItem key={link.href} link={link} active={isActive(pathname, link.href)} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

// Flattened single-row variant for the mobile top bar (sidebar hidden below md).
export function MobileNav() {
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
          </Link>
        );
      })}
    </nav>
  );
}
