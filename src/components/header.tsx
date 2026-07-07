import { Suspense } from "react";
import Link from "next/link";
import { Nav } from "./nav";
import { RefreshedAt, RefreshedAtSkeleton } from "./refreshed-at";

export function Header() {
  return (
    <header className="mb-6 pb-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pb-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Nexus <span className="text-gold">HQ</span>
        </Link>
        <Nav />
        <div className="ml-auto">
          <Suspense fallback={<RefreshedAtSkeleton />}>
            <RefreshedAt />
          </Suspense>
        </div>
      </div>
      <div className="hud-scanline h-px w-full" />
    </header>
  );
}
