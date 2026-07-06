import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase-server";

// Last-updated status for the product datasets the main site runs on.
// Timestamp columns verified against fairway-mvp's SQL (create-tables.sql,
// create-jgs-table.sql, add-tournament*-table.sql) — all six tables are
// public_read, so the founder session reads them without the service role.
//
// Most of these are import-style tables with created_at only, so "last
// updated" means "newest row" — an in-place UPDATE without a timestamp
// column won't show here. Good enough for "when did we last load data".

interface DatasetSpec {
  key: string;
  label: string;
  description: string;
  table: string;
  // Ordered by preference; first column that exists/has data wins.
  timestampColumns: string[];
}

const DATASETS: DatasetSpec[] = [
  {
    key: "schools",
    label: "Colleges & stats",
    description: "Programs, scoring averages, GPA/SAT, tuition",
    table: "schools",
    timestampColumns: ["created_at"],
  },
  {
    key: "coaches",
    label: "Coaches",
    description: "Coaching staff contacts per program",
    table: "coaches",
    timestampColumns: ["updated_at", "created_at"],
  },
  {
    key: "roster_players",
    label: "Roster players",
    description: "Current college rosters",
    table: "roster_players",
    timestampColumns: ["created_at"],
  },
  {
    key: "jgs_rankings",
    label: "JGS player rankings",
    description: "Junior golf player rankings",
    table: "jgs_rankings",
    timestampColumns: ["created_at"],
  },
  {
    key: "tournaments",
    label: "Tournaments",
    description: "Tournament calendar",
    table: "tournaments",
    timestampColumns: ["created_at"],
  },
  {
    key: "tournament_details",
    label: "Tournament details",
    description: "Scraped tournament fields & results",
    table: "tournament_details",
    timestampColumns: ["last_scraped_at", "updated_at"],
  },
];

export interface DatasetFreshness {
  key: string;
  label: string;
  description: string;
  rowCount: number;
  lastUpdatedAt: string | null; // null = table empty or column all-NULL
  ageDays: number | null;
}

export const getDataFreshness = cache(async (): Promise<DatasetFreshness[]> => {
  const supabase = createSupabaseServerClient();

  return Promise.all(
    DATASETS.map(async (spec): Promise<DatasetFreshness> => {
      let lastUpdatedAt: string | null = null;
      let rowCount = 0;

      for (const column of spec.timestampColumns) {
        const { data, count, error } = await supabase
          .from(spec.table)
          .select(column, { count: "exact" })
          .not(column, "is", null)
          .order(column, { ascending: false })
          .limit(1);

        if (error) continue; // column missing / no access — try the fallback

        rowCount = Math.max(rowCount, count ?? 0);
        const value = (data?.[0] as unknown as Record<string, string> | undefined)?.[column];
        if (value) {
          lastUpdatedAt = value;
          break;
        }
      }

      // Row count even when every timestamp is NULL (old imports).
      if (rowCount === 0) {
        const { count } = await supabase
          .from(spec.table)
          .select("*", { count: "exact", head: true });
        rowCount = count ?? 0;
      }

      const ageDays = lastUpdatedAt
        ? Math.floor((Date.now() - new Date(lastUpdatedAt).getTime()) / 86_400_000)
        : null;

      return {
        key: spec.key,
        label: spec.label,
        description: spec.description,
        rowCount,
        lastUpdatedAt,
        ageDays,
      };
    })
  );
});
