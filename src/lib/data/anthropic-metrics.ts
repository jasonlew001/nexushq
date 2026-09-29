import { unstable_cache } from "next/cache";
import { fetchCostReport, fetchUsageReport } from "@/lib/anthropic";
import { COST_HISTORY_MONTHS } from "@/lib/constants";
import type { CachedResult } from "@/lib/types";

if (typeof window !== "undefined") {
  throw new Error("anthropic-metrics.ts must never be imported client-side");
}

export interface DailyCost {
  date: string; // YYYY-MM-DD
  costCents: number;
}

export interface DailyUsage {
  date: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}

export interface MonthlyCost {
  month: string; // YYYY-MM
  costCents: number;
}

export interface AnthropicMetrics {
  dailyCost: DailyCost[];
  dailyUsage: DailyUsage[];
  monthToDateCents: number;
  previousMonthCents: number;
  // Trailing COST_HISTORY_MONTHS calendar months (oldest first, current
  // month last & partial), zero-filled — feeds the costs-vs-revenue chart.
  monthlyCost: MonthlyCost[];
  // Set when this fetch cycle failed (Admin API 429/5xx). Same contract as
  // Instagram's: callers show a degraded readout instead of a confident $0,
  // which would read as "we spent nothing" rather than "we don't know".
  error: string | null;
}

function chunkDateRange(start: Date, end: Date, maxDays = 31): { startingAt: string; endingAt: string }[] {
  const chunks: { startingAt: string; endingAt: string }[] = [];
  let cursor = new Date(start);

  while (cursor < end) {
    const chunkEnd = new Date(cursor);
    chunkEnd.setUTCDate(chunkEnd.getUTCDate() + maxDays);
    const actualEnd = chunkEnd < end ? chunkEnd : end;
    chunks.push({ startingAt: cursor.toISOString(), endingAt: actualEnd.toISOString() });
    cursor = actualEnd;
  }

  return chunks;
}

async function fetchCostReportChunked(start: Date, end: Date) {
  const chunks = chunkDateRange(start, end);
  const results = await Promise.all(
    chunks.map((c) => fetchCostReport(c.startingAt, c.endingAt))
  );
  return results.flat();
}

async function fetchUsageReportChunked(start: Date, end: Date) {
  const chunks = chunkDateRange(start, end);
  const results = await Promise.all(
    chunks.map((c) => fetchUsageReport(c.startingAt, c.endingAt))
  );
  return results.flat();
}

async function fetchAnthropicMetricsRaw(): Promise<CachedResult<AnthropicMetrics>> {
  const now = new Date();
  // First day of the month COST_HISTORY_MONTHS-1 months back, UTC — covers
  // the costs-vs-revenue chart's window (which subsumes the old 2-month
  // window the MTD/prev-month trend needs). Still one cached fetch per hour;
  // the 31-day-bucket chunker just makes a few more paged requests.
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (COST_HISTORY_MONTHS - 1), 1)
  );

  const [costBuckets, usageBuckets] = await Promise.all([
    fetchCostReportChunked(start, now),
    fetchUsageReportChunked(start, now),
  ]);

  const dailyCost: DailyCost[] = costBuckets.map((b) => ({
    date: b.starting_at.slice(0, 10),
    costCents: b.results.reduce((sum, r) => sum + Number(r.amount || "0"), 0),
  }));

  const dailyUsage: DailyUsage[] = usageBuckets.map((b) => {
    let inputTokens = 0;
    let cachedInputTokens = 0;
    let outputTokens = 0;
    for (const r of b.results) {
      inputTokens += r.uncached_input_tokens ?? 0;
      cachedInputTokens +=
        (r.cache_read_input_tokens ?? 0) +
        (r.cache_creation?.ephemeral_1h_input_tokens ?? 0) +
        (r.cache_creation?.ephemeral_5m_input_tokens ?? 0);
      outputTokens += r.output_tokens ?? 0;
    }
    return { date: b.starting_at.slice(0, 10), inputTokens, cachedInputTokens, outputTokens };
  });

  const thisMonthKey = now.toISOString().slice(0, 7);
  const prevMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const prevMonthKey = prevMonthDate.toISOString().slice(0, 7);

  const monthToDateCents = dailyCost
    .filter((d) => d.date.slice(0, 7) === thisMonthKey)
    .reduce((sum, d) => sum + d.costCents, 0);
  const previousMonthCents = dailyCost
    .filter((d) => d.date.slice(0, 7) === prevMonthKey)
    .reduce((sum, d) => sum + d.costCents, 0);

  // Zero-filled trailing months, oldest first, current (partial) month last.
  const monthlyCost: MonthlyCost[] = [];
  for (let i = COST_HISTORY_MONTHS - 1; i >= 0; i--) {
    const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
      .toISOString()
      .slice(0, 7);
    const costCents = dailyCost
      .filter((d) => d.date.slice(0, 7) === month)
      .reduce((sum, d) => sum + d.costCents, 0);
    monthlyCost.push({ month, costCents });
  }

  return {
    data: { dailyCost, dailyUsage, monthToDateCents, previousMonthCents, monthlyCost, error: null },
    fetchedAt: new Date().toISOString(),
  };
}

const EMPTY: AnthropicMetrics = {
  dailyCost: [],
  dailyUsage: [],
  monthToDateCents: 0,
  previousMonthCents: 0,
  monthlyCost: [],
  error: null,
};

// An uncaught throw here took down EVERY page, not just the cost ones:
// RefreshedAt calls this from the sidebar, so a single Admin API 429 turned
// the whole app into "Application error: a server-side exception". Worse,
// unstable_cache does not cache a rejection, so every render retried and
// kept the rate limit alive. Returning a degraded value instead means the
// failure is cached for the hour and the retry storm stops; "Sync data"
// (revalidateTag "hq-anthropic") forces a retry sooner.
async function fetchAnthropicMetrics(): Promise<CachedResult<AnthropicMetrics>> {
  try {
    return await fetchAnthropicMetricsRaw();
  } catch (err) {
    console.error("Anthropic: failed to fetch usage/cost report", err);
    const rateLimited = err instanceof Error && err.message.includes("429");
    return {
      data: {
        ...EMPTY,
        error: rateLimited
          ? "Anthropic rate-limited the cost report. It retries hourly, or click Sync data."
          : "Anthropic cost data is temporarily unavailable.",
      },
      fetchedAt: new Date().toISOString(),
    };
  }
}

// Anthropic's usage/cost data updates roughly every 5 min; polling more
// than hourly is unnecessary (and the spec asks for hourly at most).
export const getAnthropicMetrics = unstable_cache(fetchAnthropicMetrics, ["hq-anthropic-metrics"], {
  revalidate: 3600,
  tags: ["hq-anthropic"],
});
