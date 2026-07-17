import { requireFounder } from "@/lib/auth";
import { Header } from "@/components/header";
import { Sidebar, MobileTopBar } from "@/components/sidebar";

export const dynamic = "force-dynamic";

// Shared shell for every dashboard page. requireFounder() here covers the
// initial load; every page below also calls it (React cache() dedupes to one
// auth round-trip per request), since layouts don't re-render on soft
// navigation — the per-page call is the one that gates client-side nav.
export default async function HqLayout({ children }: { children: React.ReactNode }) {
  await requireFounder();

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="min-w-0 flex-1 px-6 py-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <MobileTopBar />
          <Header />
          {children}
        </div>
      </main>
    </div>
  );
}
