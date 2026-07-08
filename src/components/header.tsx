import { Suspense } from "react";
import Link from "next/link";
import { Nav } from "./nav";
import { RefreshedAt, RefreshedAtSkeleton } from "./refreshed-at";
import { SyncButton } from "./sync-button";

export function Header() {
  return (
    <header className="mb-6 pb-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pb-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Nexus <span className="text-gold">HQ</span>
        </Link>
        <Nav />
        <div className="ml-auto flex items-center gap-3">
          <Suspense fallback={<RefreshedAtSkeleton />}>
            <RefreshedAt />
          </Suspense>
          <SyncButton />
        </div>
      </div>
      <div className="hud-scanline h-px w-full" />
    </header>
  );
}
