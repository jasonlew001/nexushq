import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// Detail-page wrapper: back link + title + the zoom-in entrance that makes
// navigating from an overview card feel like zooming into the section.
export function PageShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="motion-safe:animate-zoom-in">
      <div className="mb-5">
        <Link
          href="/"
          className="mb-2 inline-flex items-center gap-1 text-xs text-faint transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-3 w-3" /> Overview
        </Link>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </div>
      {children}
    </div>
  );
}
