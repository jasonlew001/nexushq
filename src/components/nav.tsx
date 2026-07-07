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
    <nav className="flex items-center gap-1 overflow-x-auto font-mono">
      {LINKS.map((link) => {
        const active =
          link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "whitespace-nowrap rounded-md border-b-2 px-2.5 py-1.5 text-xs uppercase tracking-wide transition-colors",
              active
                ? "border-accent text-accent shadow-[0_2px_8px_-2px_hsl(var(--accent)/0.9)]"
                : "border-transparent text-muted hover:bg-surface-2/60 hover:text-ink"
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
