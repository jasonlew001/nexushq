import { Suspense } from "react";
import { Database } from "lucide-react";
import { requireFounder } from "@/lib/auth";
import { PageShell } from "@/components/page-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getDataFreshness } from "@/lib/data/freshness";
import { formatDate, formatRelativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";

// Freshness tone: imports happen in batches, so a few weeks old is normal —
// flag things that look forgotten, not merely not-daily.
function ageTone(ageDays: number | null): { tone: "accent" | "neutral" | "warn" | "danger"; label: string } {
  if (ageDays == null) return { tone: "danger", label: "no timestamp" };
  if (ageDays <= 7) return { tone: "accent", label: "fresh" };
  if (ageDays <= 30) return { tone: "neutral", label: "recent" };
  if (ageDays <= 90) return { tone: "warn", label: "aging" };
  return { tone: "danger", label: "stale" };
}

async function FreshnessGrid() {
  const datasets = await getDataFreshness();

  return (
    <div className="stagger grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {datasets.map((dataset) => {
        const { tone, label } = ageTone(dataset.ageDays);
        return (
          <Card key={dataset.key}>
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Database className="h-3.5 w-3.5 text-faint" strokeWidth={1.5} />
                <p className="text-sm font-medium">{dataset.label}</p>
              </div>
              <Badge tone={tone}>{label}</Badge>
            </div>
            <p className="mb-3 text-xs text-faint">{dataset.description}</p>
            <div className="flex items-baseline justify-between text-xs">
              <span className="tnum text-muted">{dataset.rowCount.toLocaleString()} rows</span>
              {dataset.lastUpdatedAt ? (
                <span className="tnum" title={formatDate(dataset.lastUpdatedAt)}>
                  updated {formatRelativeTime(dataset.lastUpdatedAt)}
                </span>
              ) : (
                <span className="text-faint">never / unknown</span>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

export default async function DataPage() {
  await requireFounder();

  return (
    <PageShell
      title="Data health"
      description="When each product dataset was last loaded — newest row per table"
    >
      <Suspense
        fallback={
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-lg" />
            ))}
          </div>
        }
      >
        <FreshnessGrid />
      </Suspense>
      <p className="mt-4 text-xs text-faint">
        Most of these tables only stamp rows at insert time, so &ldquo;updated&rdquo; means the
        newest row loaded — an in-place edit without a timestamp column won&apos;t move it.
      </p>
    </PageShell>
  );
}
