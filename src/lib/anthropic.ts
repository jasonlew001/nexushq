if (typeof window !== "undefined") {
  throw new Error("anthropic.ts must never be imported client-side");
}

const API_BASE = "https://api.anthropic.com/v1/organizations";
const API_VERSION = "2023-06-01";

// Schema verified against platform.claude.com/docs/en/api/admin-api/usage-cost
// (Get Cost Report / Get Messages Usage Report) — not guessed.

export interface CostReportResult {
  amount: string; // decimal string, lowest currency unit (cents) — "123.45" = $1.23
  currency: string;
  cost_type: string | null;
  description: string | null;
  model: string | null;
  workspace_id: string | null;
}

export interface CostReportBucket {
  starting_at: string;
  ending_at: string;
  results: CostReportResult[];
}

interface CostReportResponse {
  data: CostReportBucket[];
  has_more: boolean;
  next_page: string | null;
}

export interface UsageReportResult {
  uncached_input_tokens: number;
  cache_read_input_tokens: number;
  cache_creation: {
    ephemeral_1h_input_tokens: number;
    ephemeral_5m_input_tokens: number;
  };
  output_tokens: number;
  model: string | null;
}

export interface UsageReportBucket {
  starting_at: string;
  ending_at: string;
  results: UsageReportResult[];
}

interface UsageReportResponse {
  data: UsageReportBucket[];
  has_more: boolean;
  next_page: string | null;
}

function requireAdminKey(): string {
  const key = process.env.ANTHROPIC_ADMIN_KEY;
  if (!key) throw new Error("ANTHROPIC_ADMIN_KEY not configured");
  return key;
}

async function anthropicGet<T>(path: string, params: URLSearchParams): Promise<T> {
  const key = requireAdminKey();
  const res = await fetch(`${API_BASE}${path}?${params.toString()}`, {
    headers: { "x-api-key": key, "anthropic-version": API_VERSION },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Anthropic Admin API ${path} returned ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// bucket_width=1d caps at 31 buckets/request (per Anthropic's documented
// limits) — callers are expected to chunk ranges longer than ~31 days
// before calling these.
export async function fetchCostReport(
  startingAt: string,
  endingAt: string
): Promise<CostReportBucket[]> {
  const buckets: CostReportBucket[] = [];
  let page: string | undefined;

  for (;;) {
    const params = new URLSearchParams({
      starting_at: startingAt,
      ending_at: endingAt,
      bucket_width: "1d",
      limit: "31",
    });
    if (page) params.set("page", page);

    const data = await anthropicGet<CostReportResponse>("/cost_report", params);
    buckets.push(...data.data);

    if (!data.has_more || !data.next_page) break;
    page = data.next_page;
  }

  return buckets;
}

export async function fetchUsageReport(
  startingAt: string,
  endingAt: string
): Promise<UsageReportBucket[]> {
  const buckets: UsageReportBucket[] = [];
  let page: string | undefined;

  for (;;) {
    const params = new URLSearchParams({
      starting_at: startingAt,
      ending_at: endingAt,
      bucket_width: "1d",
      limit: "31",
    });
    if (page) params.set("page", page);

    const data = await anthropicGet<UsageReportResponse>("/usage_report/messages", params);
    buckets.push(...data.data);

    if (!data.has_more || !data.next_page) break;
    page = data.next_page;
  }

  return buckets;
}
