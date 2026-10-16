import Link from "next/link";
import { cn } from "@/lib/cn";

// Library | Insights | Our posts toggle shared by the /inspiration pages.
export function InspirationSwitcher({ active }: { active: "library" | "insights" | "ours" }) {
  const item = (key: "library" | "insights" | "ours", href: string, label: string) => (
    <Link
      href={href}
      aria-current={active === key ? "page" : undefined}
      className={cn(
        "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
        active === key ? "bg-surface text-ink shadow-[0_1px_2px_rgba(16,24,40,0.06)]" : "text-muted hover:text-ink"
      )}
    >
      {label}
    </Link>
  );

  return (
    <div className="mb-4 inline-flex gap-0.5 rounded-lg border border-edge bg-surface-2 p-0.5">
      {item("library", "/inspiration", "Library")}
      {item("insights", "/inspiration/insights", "Insights")}
      {item("ours", "/inspiration/ours", "Our posts")}
    </div>
  );
}
