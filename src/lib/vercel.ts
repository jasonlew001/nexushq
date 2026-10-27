if (typeof window !== "undefined") {
  throw new Error("vercel.ts must never be imported client-side");
}

const API_BASE = "https://api.vercel.com";
const TIMEOUT_MS = 20_000;

// The main site (nexusgolfrecruiting.com) is the "fairway-mvp-otsc" project
// in the "Jason Lew's projects" team — NOT the older "fairway-mvp" project,
// which has no production URL. IDs aren't secrets, so they default here and
// only VERCEL_TOKEN (server-only, never NEXT_PUBLIC_) has to be configured.
const DEFAULT_TEAM_ID = "team_iKINMJxLOGfu61oR23ejPetp";
const DEFAULT_PROJECT_ID = "prj_UBUfKXg9qWZzSkiOKGW1UIui0IkS";

export interface VercelScope {
  token: string;
  teamId: string;
  projectId: string;
}

// null = not connected (no token). Callers render a "connect" state rather
// than throwing, same contract as Instagram's missing-token path.
export function getVercelScope(): VercelScope | null {
  const token = process.env.VERCEL_TOKEN;
  if (!token) return null;
  return {
    token,
    teamId: process.env.VERCEL_TEAM_ID || DEFAULT_TEAM_ID,
    projectId: process.env.VERCEL_PROJECT_ID || DEFAULT_PROJECT_ID,
  };
}

// Read-only by design: every call is a GET except the observability query,
// which is a POST only because the query body is JSON.
async function vercelRequest<T>(
  scope: VercelScope,
  path: string,
  params: Record<string, string> = {},
  body?: unknown
): Promise<T> {
  const search = new URLSearchParams({ ...params, teamId: scope.teamId });
  const res = await fetch(`${API_BASE}${path}?${search.toString()}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${scope.token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Vercel API ${path} returned ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Response subsets. Shapes verified against live responses (2026-10-27), only
// the fields HQ reads.

export interface VercelDeployment {
  uid: string;
  url: string;
  created: number;
  // READY | ERROR | BUILDING | QUEUED | INITIALIZING | CANCELED | BLOCKED
  state: string;
  target: string | null;
  buildingAt?: number;
  ready?: number;
  source?: string;
  inspectorUrl?: string;
  errorMessage?: string;
  meta?: {
    githubCommitSha?: string;
    githubCommitMessage?: string;
    githubCommitRef?: string;
    githubCommitAuthorName?: string;
    githubOrg?: string;
    githubRepo?: string;
  };
}

export interface VercelEnvVar {
  key: string;
  // plain | encrypted | sensitive | secret | system
  type: string;
  target?: string[];
  updatedAt?: number;
}

export interface VercelProject {
  id: string;
  name: string;
  env: VercelEnvVar[];
  link?: { org?: string; repo?: string; productionBranch?: string };
  webAnalytics?: { enabledAt?: number; disabledAt?: number; hasData?: boolean };
  speedInsights?: { enabledAt?: number; disabledAt?: number; hasData?: boolean };
  targets?: { production?: { id: string; createdAt: number } };
}

export interface VercelProjectDomain {
  name: string;
  verified: boolean;
  redirect?: string | null;
}

export interface VercelDomainConfig {
  misconfigured: boolean;
  configuredBy: string | null;
  nameservers?: string[];
}

export interface VercelDomainInfo {
  expiresAt: number | null;
  renew?: boolean;
  serviceType?: string;
  boughtAt?: number | null;
}

export async function fetchProject(scope: VercelScope): Promise<VercelProject> {
  return vercelRequest<VercelProject>(scope, `/v9/projects/${scope.projectId}`);
}

export async function fetchProductionDeployments(
  scope: VercelScope,
  limit = 100
): Promise<VercelDeployment[]> {
  const res = await vercelRequest<{ deployments: VercelDeployment[] }>(scope, "/v6/deployments", {
    projectId: scope.projectId,
    target: "production",
    limit: String(limit),
  });
  return res.deployments;
}

export async function fetchProjectDomains(scope: VercelScope): Promise<VercelProjectDomain[]> {
  const res = await vercelRequest<{ domains: VercelProjectDomain[] }>(
    scope,
    `/v9/projects/${scope.projectId}/domains`
  );
  return res.domains;
}

export async function fetchDomainConfig(
  scope: VercelScope,
  domain: string
): Promise<VercelDomainConfig> {
  return vercelRequest<VercelDomainConfig>(scope, `/v6/domains/${encodeURIComponent(domain)}/config`);
}

// Registration info (expiry/auto-renew). 404s for domains this team doesn't
// own (e.g. *.vercel.app) — callers treat a throw as "no registration data".
export async function fetchDomainInfo(scope: VercelScope, domain: string): Promise<VercelDomainInfo> {
  const res = await vercelRequest<{ domain: VercelDomainInfo }>(
    scope,
    `/v5/domains/${encodeURIComponent(domain)}`
  );
  return res.domain;
}

// ---------------------------------------------------------------------------
// Web Analytics — counts default to the production environment.

export async function fetchVisitCount(
  scope: VercelScope,
  since: Date,
  until: Date
): Promise<{ visitors: number; pageviews: number }> {
  const res = await vercelRequest<{ data: { visitors: number; pageviews: number } }>(
    scope,
    "/v1/query/web-analytics/visits/count",
    { projectId: scope.projectId, since: since.toISOString(), until: until.toISOString() }
  );
  return res.data;
}

export type VisitRow = { visitors: number; pageviews: number } & Record<string, string | number>;

export async function fetchVisitAggregate(
  scope: VercelScope,
  by: "day" | "requestPath" | "referrerHostname",
  since: Date,
  until: Date,
  limit = 10
): Promise<VisitRow[]> {
  const res = await vercelRequest<{ data: VisitRow[] }>(
    scope,
    "/v1/query/web-analytics/visits/aggregate",
    {
      projectId: scope.projectId,
      by,
      since: since.toISOString(),
      until: until.toISOString(),
      limit: String(limit),
    }
  );
  return res.data;
}

// ---------------------------------------------------------------------------
// Observability metrics. Filter syntax is OData (`eq`, `ge`, `and`, `or`),
// not the KQL the CLI accepts. Result rows carry the groupBy dimensions plus
// a rollup key named `<metric with dots→underscores>_<aggregation>`.

export interface ObservabilityRow {
  timestamp?: string;
  route?: string | null;
  http_status?: string | null;
  [rollup: string]: string | number | null | undefined;
}

export async function queryRequestCount(
  scope: VercelScope,
  opts: {
    since: Date;
    until: Date;
    granularityDays: number;
    groupBy: string[];
    filter: string;
    limit: number;
  }
): Promise<{ summary: ObservabilityRow[]; data: ObservabilityRow[] }> {
  return vercelRequest(scope, "/v2/observability/query", {}, {
    scope: { type: "project", ownerId: scope.teamId, projectIds: [scope.projectId] },
    metric: "vercel.request.count",
    aggregation: "sum",
    startTime: opts.since.toISOString(),
    endTime: opts.until.toISOString(),
    granularity: { days: opts.granularityDays },
    groupBy: opts.groupBy,
    filter: opts.filter,
    limit: opts.limit,
  });
}

export const REQUEST_COUNT_KEY = "vercel_request_count_sum";
