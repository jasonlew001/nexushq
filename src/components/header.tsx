import { Suspense } from "react";
import { RefreshedAt, RefreshedAtSkeleton } from "./refreshed-at";

export function Header() {
  return (
    <header className="mb-6 flex items-center justify-between">
      <h1 className="text-lg font-semibold tracking-tight">
        Nexus <span className="text-gold">HQ</span>
      </h1>
      <Suspense fallback={<RefreshedAtSkeleton />}>
        <RefreshedAt />
      </Suspense>
    </header>
  );
}
