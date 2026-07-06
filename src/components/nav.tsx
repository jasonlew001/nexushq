"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/growth", label: "Growth" },
  { href: "/revenue", label: "Revenue" },
  { href: "/customers", label: "Customers" },
  { href: "/costs", label: "Costs" },
  { href: "/data", label: "Data" },
] as const;

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 overflow-x-auto">
      {LINKS.map((link) => {
        const active =
          link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs transition-colors",
              active
                ? "bg-surface-2 font-medium text-ink"
                : "text-muted hover:bg-surface-2/60 hover:text-ink"
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
