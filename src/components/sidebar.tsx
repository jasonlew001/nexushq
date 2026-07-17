import { Suspense } from "react";
import Link from "next/link";
import { SidebarNav, MobileNav } from "./nav";
import { RefreshedAt, RefreshedAtSkeleton } from "./refreshed-at";

// Desktop rail: logo, grouped nav, pinned "synced" readout at the bottom.
// Hidden below md — MobileTopBar below takes over navigation there.
export function Sidebar() {
  return (
    <aside className="sidebar-stagger sticky top-0 hidden h-screen w-[216px] shrink-0 flex-col border-r border-edge px-3 py-4 md:flex">
      <Link href="/" style={{ "--i": 0 } as React.CSSProperties} className="mb-6 flex items-center gap-2 px-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="h-8 w-8" />
        <span className="text-[15px] font-semibold tracking-tight">Nexus HQ</span>
      </Link>

      <div style={{ "--i": 1 } as React.CSSProperties}>
        <SidebarNav />
      </div>

      <div className="mt-auto px-3 pt-4" style={{ "--i": 9 } as React.CSSProperties}>
        <Suspense fallback={<RefreshedAtSkeleton />}>
          <RefreshedAt />
        </Suspense>
      </div>
    </aside>
  );
}

// Compact top bar shown only below md, since the rail is hidden there.
export function MobileTopBar() {
  return (
    <div className="mb-4 flex items-center gap-4 border-b border-edge pb-3 md:hidden">
      <Link href="/" className="flex shrink-0 items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="h-7 w-7" />
        <span className="text-sm font-semibold tracking-tight">Nexus HQ</span>
      </Link>
      <MobileNav />
    </div>
  );
}
