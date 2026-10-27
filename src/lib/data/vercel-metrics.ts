import { unstable_cache } from "next/cache";
import {
  getVercelScope,
  fetchProject,
  fetchProductionDeployments,
  fetchProjectDomains,
  fetchDomainConfig,
  fetchDomainInfo,
  fetchVisitCount,
  fetchVisitAggregate,
  queryRequestCount,
  REQUEST_COUNT_KEY,
  type VercelDeployment,
  type VercelEnvVar,
  type ObservabilityRow,
} from "@/lib/vercel";
import { VERCEL_WATCH_ROUTES, DOMAIN_EXPIRY_WARN_DAYS } from "@/lib/constants";
import type { CachedResult } from "@/lib/types";

if (typeof window !== "undefined") {
  throw new Error("vercel-metrics.ts must never be imported client-side");
}

// Every reader below shares Instagram's contract: connected=false means no
// VERCEL_TOKEN (render a setup hint), error!=null means this fetch cycle
// failed (render a degraded state) — never a confident zero. All four are
// tagged "hq-vercel" so Sync data refreshes them together.
const TAGS = ["hq-vercel"];
const DAY_MS = 86_400_000;

function startOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function lastNDays(n: number): string[] {
  const today = startOfDayUTC(new Date()).getTime();
  return Array.from({ length: n }, (_, i) =>
    new Date(today - (n - 1 - i) * DAY_MS).toISOString().slice(0, 10)
  );
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ---------------------------------------------------------------------------
// Deploys

export interface DeployRow {
  id: string;
  createdAt: string;
  state: string;
  buildSeconds: number | null;
  sha: string | null;
  message: string | null; // first line of the commit message
  author: string | null;
  inspectorUrl: string | null;
  errorMessage: string | null;
  isLive: boolean;
}

export interface VercelDeploys {
  connected: boolean;
  error: string | null;
  projectName: string | null;
  repoUrl: string | null;
  live: DeployRow | null;
  // Newest production deployment, if it isn't the live one (building, or
  // failed after the live one shipped).
  pending: DeployRow | null;
  history: DeployRow[]; // newest first
  failures: DeployRow[]; // ERROR / BLOCKED / CANCELED, newest first
  deploysLast7d: number;
  failedLast7d: number;
  medianBuildSeconds: number | null;
}

const EMPTY_DEPLOYS: VercelDeploys = {
  connected: false,
  error: null,
  projectName: null,
  repoUrl: null,
  live: null,
  pending: null,
  history: [],
  failures: [],
  deploysLast7d: 0,
  failedLast7d: 0,
  medianBuildSeconds: null,
};

export const FAILED_STATES = new Set(["ERROR", "BLOCKED", "CANCELED"]);
export const IN_PROGRESS_STATES = new Set(["BUILDING", "QUEUED", "INITIALIZING"]);

function toDeployRow(d: VercelDeployment, liveId: string | undefined): DeployRow {
  const started = d.buildingAt ?? d.created;
  return {
    id: d.uid,
    createdAt: new Date(d.created).toISOString(),
    state: d.state,
    buildSeconds: d.state === "READY" && d.ready ? Math.round((d.ready - started) / 1000) : null,
    sha: d.meta?.githubCommitSha?.slice(0, 7) ?? null,
    message: d.meta?.githubCommitMessage?.split("\n")[0]?.trim() || null,
    author: d.meta?.githubCommitAuthorName ?? null,
    inspectorUrl: d.inspectorUrl ?? null,
    errorMessage: d.errorMessage ?? null,
    isLive: d.uid === liveId,
  };
}

async function fetchVercelDeploys(): Promise<CachedResult<VercelDeploys>> {
  const fetchedAt = new Date().toISOString();
  const scope = getVercelScope();
  if (!scope) return { data: EMPTY_DEPLOYS, fetchedAt };

  try {
    const [project, deployments] = await Promise.all([
      fetchProject(scope),
      fetchProductionDeployments(scope, 100),
    ]);
    const liveId = project.targets?.production?.id;
    const rows = deployments.map((d) => toDeployRow(d, liveId));
    const live = rows.find((r) => r.isLive) ?? rows.find((r) => r.state === "READY") ?? null;
    const newest = rows[0] ?? null;
    const weekAgo = Date.now() - 7 * DAY_MS;
    const lastWeek = rows.filter((r) => new Date(r.createdAt).getTime() >= weekAgo);
    const repo = project.link?.org && project.link?.repo ? `${project.link.org}/${project.link.repo}` : null;

    return {
      data: {
        connected: true,
        error: null,
        projectName: project.name,
        repoUrl: repo ? `https://github.com/${repo}` : null,
        live,
        pending: newest && live && newest.id !== live.id ? newest : null,
        history: rows.slice(0, 40),
        failures: rows.filter((r) => FAILED_STATES.has(r.state)).slice(0, 8),
        deploysLast7d: lastWeek.length,
        failedLast7d: lastWeek.filter((r) => FAILED_STATES.has(r.state)).length,
        medianBuildSeconds: median(
          rows.slice(0, 20).flatMap((r) => (r.buildSeconds != null ? [r.buildSeconds] : []))
        ),
      },
      fetchedAt,
    };
  } catch (err) {
    console.error("Vercel: deployments fetch failed", err);
    return {
      data: { ...EMPTY_DEPLOYS, connected: true, error: "Couldn't reach the Vercel API." },
      fetchedAt,
    };
  }
}

export const getVercelDeploys = unstable_cache(fetchVercelDeploys, ["hq-vercel-deploys"], {
  revalidate: 300,
  tags: TAGS,
});

// ---------------------------------------------------------------------------
// Errors — production 5xx by route over the trailing 7 UTC days, plus the
// Stripe webhook's 4xx (a 400 there means signature verification failed,
// i.e. payments silently not syncing). Request totals give an error rate.

export interface RouteHealth {
  route: string;
  watched: boolean;
  requests: number | null; // null = route outside the totals we fetched
  errors: number; // 5xx (plus 4xx for the Stripe webhook)
  statuses: string[]; // distinct error codes seen, e.g. ["500", "504"]
  daily: number[]; // errors per day, aligned with VercelErrors.days
}

export interface VercelErrors {
  connected: boolean;
  error: string | null;
  days: string[]; // YYYY-MM-DD, oldest first, today last (partial)
  dailyErrors: number[];
  totalErrors: number;
  errorsToday: number;
  routes: RouteHealth[]; // errored routes first (by count), then quiet watched ones
}

const STRIPE_WEBHOOK = "/api/stripe/webhook";

const EMPTY_ERRORS: VercelErrors = {
  connected: false,
  error: null,
  days: [],
  dailyErrors: [],
  totalErrors: 0,
  errorsToday: 0,
  routes: [],
};

function odataString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function rollup(row: ObservabilityRow): number {
  const v = row[REQUEST_COUNT_KEY];
  return typeof v === "number" ? v : Number(v) || 0;
}

async function fetchVercelErrors(): Promise<CachedResult<VercelErrors>> {
  const fetchedAt = new Date().toISOString();
  const scope = getVercelScope();
  if (!scope) return { data: EMPTY_ERRORS, fetchedAt };

  const days = lastNDays(7);
  const since = new Date(`${days[0]}T00:00:00.000Z`);
  const until = new Date();
  const prod = "environment eq 'production'";
  const watchFilter = VERCEL_WATCH_ROUTES.map((r) => `route eq ${odataString(r)}`).join(" or ");

  try {
    // Three independent queries (~7s each server-side), run in parallel:
    // error rows by day, top-100 route totals, and the watch-list's totals
    // (low-traffic routes like the Stripe webhook fall outside the top 100).
    const [errorRes, topRes, watchRes] = await Promise.all([
      queryRequestCount(scope, {
        since,
        until,
        granularityDays: 1,
        groupBy: ["route", "http_status"],
        filter: `${prod} and (http_status ge 500 or (route eq ${odataString(STRIPE_WEBHOOK)} and http_status ge 400))`,
        limit: 100,
      }),
      queryRequestCount(scope, {
        since,
        until,
        granularityDays: 7,
        groupBy: ["route"],
        filter: prod,
        limit: 100,
      }),
      queryRequestCount(scope, {
        since,
        until,
        granularityDays: 7,
        groupBy: ["route"],
        filter: `${prod} and (${watchFilter})`,
        limit: VERCEL_WATCH_ROUTES.length,
      }),
    ]);

    const totals = new Map<string, number>();
    for (const row of [...topRes.summary, ...watchRes.summary]) {
      if (row.route) totals.set(row.route, rollup(row));
    }

    const byRoute = new Map<string, RouteHealth>();
    const ensure = (route: string): RouteHealth => {
      let h = byRoute.get(route);
      if (!h) {
        h = {
          route,
          watched: (VERCEL_WATCH_ROUTES as readonly string[]).includes(route),
          requests: totals.get(route) ?? null,
          errors: 0,
          statuses: [],
          daily: days.map(() => 0),
        };
        byRoute.set(route, h);
      }
      return h;
    };

    const dailyErrors = days.map(() => 0);
    for (const row of errorRes.data) {
      const count = rollup(row);
      if (!count || !row.timestamp) continue;
      const dayIndex = days.indexOf(row.timestamp.slice(0, 10));
      if (dayIndex === -1) continue;
      const h = ensure(row.route ?? "(unknown route)");
      h.errors += count;
      h.daily[dayIndex] += count;
      if (row.http_status && !h.statuses.includes(row.http_status)) h.statuses.push(row.http_status);
      dailyErrors[dayIndex] += count;
    }
    for (const route of VERCEL_WATCH_ROUTES) ensure(route);

    const routes = Array.from(byRoute.values()).sort(
      (a, b) => b.errors - a.errors || Number(b.watched) - Number(a.watched) || a.route.localeCompare(b.route)
    );
    for (const r of routes) r.statuses.sort();

    return {
      data: {
        connected: true,
        error: null,
        days,
        dailyErrors,
        totalErrors: dailyErrors.reduce((a, b) => a + b, 0),
        errorsToday: dailyErrors.at(-1) ?? 0,
        routes,
      },
      fetchedAt,
    };
  } catch (err) {
    console.error("Vercel: observability query failed", err);
    return {
      data: { ...EMPTY_ERRORS, connected: true, error: "Couldn't load error metrics from Vercel." },
      fetchedAt,
    };
  }
}

export const getVercelErrors = unstable_cache(fetchVercelErrors, ["hq-vercel-errors"], {
  revalidate: 900,
  tags: TAGS,
});

// ---------------------------------------------------------------------------
// Traffic — Vercel Web Analytics (production only, by default).

export interface TrafficDay {
  date: string;
  visitors: number;
  pageviews: number;
}

export interface TrafficRow {
  label: string;
  visitors: number;
}

export interface VercelTraffic {
  connected: boolean;
  error: string | null;
  visitors7d: number;
  pageviews7d: number;
  visitorsPrev7d: number | null;
  daily: TrafficDay[]; // trailing 30 days, oldest first, zero-filled
  topPages: TrafficRow[];
  referrers: TrafficRow[];
}

const EMPTY_TRAFFIC: VercelTraffic = {
  connected: false,
  error: null,
  visitors7d: 0,
  pageviews7d: 0,
  visitorsPrev7d: null,
  daily: [],
  topPages: [],
  referrers: [],
};

async function fetchVercelTraffic(): Promise<CachedResult<VercelTraffic>> {
  const fetchedAt = new Date().toISOString();
  const scope = getVercelScope();
  if (!scope) return { data: EMPTY_TRAFFIC, fetchedAt };

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const twoWeeksAgo = new Date(now.getTime() - 14 * DAY_MS);
  const days = lastNDays(30);
  const monthStart = new Date(`${days[0]}T00:00:00.000Z`);

  try {
    const [week, prevWeek, daily, pages, refs] = await Promise.all([
      fetchVisitCount(scope, weekAgo, now),
      fetchVisitCount(scope, twoWeeksAgo, weekAgo),
      fetchVisitAggregate(scope, "day", monthStart, now, 31),
      fetchVisitAggregate(scope, "requestPath", weekAgo, now, 8),
      fetchVisitAggregate(scope, "referrerHostname", weekAgo, now, 8),
    ]);

    const byDay = new Map(daily.map((d) => [String(d.timestamp).slice(0, 10), d]));
    const toRows = (rows: typeof pages, key: string, blank: string): TrafficRow[] =>
      rows
        // "Others" is Vercel's catch-all bucket past the limit, not a page.
        .filter((r) => r[key] !== "Others")
        .map((r) => ({ label: String(r[key]) || blank, visitors: r.visitors }));

    return {
      data: {
        connected: true,
        error: null,
        visitors7d: week.visitors,
        pageviews7d: week.pageviews,
        visitorsPrev7d: prevWeek.visitors,
        daily: days.map((date) => ({
          date,
          visitors: byDay.get(date)?.visitors ?? 0,
          pageviews: byDay.get(date)?.pageviews ?? 0,
        })),
        topPages: toRows(pages, "requestPath", "/"),
        referrers: toRows(refs, "referrerHostname", "Direct / none"),
      },
      fetchedAt,
    };
  } catch (err) {
    console.error("Vercel: web analytics fetch failed", err);
    return {
      data: { ...EMPTY_TRAFFIC, connected: true, error: "Couldn't load Web Analytics from Vercel." },
      fetchedAt,
    };
  }
}

export const getVercelTraffic = unstable_cache(fetchVercelTraffic, ["hq-vercel-traffic"], {
  revalidate: 3600,
  tags: TAGS,
});

// ---------------------------------------------------------------------------
// Config — env var NAMES (values are never requested or stored) and domains.

export type Environment = "production" | "preview" | "development";

export interface EnvRow {
  key: string;
  type: string;
  targets: Environment[];
  updatedAt: string | null;
}

export interface EnvFlag {
  key: string;
  tone: "danger" | "warn";
  message: string;
}

export interface DomainRow {
  name: string;
  verified: boolean;
  redirectTo: string | null;
  misconfigured: boolean | null;
  configuredBy: string | null;
  nameservers: string[];
  expiresAt: string | null;
  autoRenew: boolean | null;
  expiringSoon: boolean;
}

export interface VercelConfig {
  connected: boolean;
  error: string | null;
  env: EnvRow[];
  envFlags: EnvFlag[];
  domains: DomainRow[];
  webAnalyticsOn: boolean;
  speedInsightsOn: boolean;
}

const EMPTY_CONFIG: VercelConfig = {
  connected: false,
  error: null,
  env: [],
  envFlags: [],
  domains: [],
  webAnalyticsOn: false,
  speedInsightsOn: false,
};

const ENV_ORDER: Environment[] = ["production", "preview", "development"];

// Names that read as secrets. ANON / PUBLISHABLE keys are designed to be
// public, so those are fine behind NEXT_PUBLIC_.
const SECRET_NAME = /(SECRET|PRIVATE|TOKEN|PASSWORD|SERVICE_ROLE|API_KEY|ADMIN|_KEY$)/;
const PUBLIC_BY_DESIGN = /(ANON|PUBLISHABLE)/;

// Pure: exported for reasoning/testing, no I/O.
export function findEnvFlags(env: EnvRow[]): EnvFlag[] {
  const flags: EnvFlag[] = [];

  for (const v of env) {
    if (v.key.startsWith("NEXT_PUBLIC_") && SECRET_NAME.test(v.key) && !PUBLIC_BY_DESIGN.test(v.key)) {
      flags.push({
        key: v.key,
        tone: "danger",
        message: "Looks like a secret, but NEXT_PUBLIC_ ships it to every browser.",
      });
    }
  }

  // Sibling drift: vars sharing a prefix (STRIPE_PRICE_MONTHLY / _6MO /
  // _ANNUAL) are almost always meant to live in the same environments. A
  // sibling missing from an environment the others have is likely a bug.
  const families = new Map<string, EnvRow[]>();
  for (const v of env) {
    const cut = v.key.lastIndexOf("_");
    if (cut <= 0) continue;
    const prefix = v.key.slice(0, cut);
    families.set(prefix, [...(families.get(prefix) ?? []), v]);
  }
  for (const [prefix, members] of Array.from(families)) {
    if (members.length < 2) continue;
    for (const target of ENV_ORDER) {
      const has = members.filter((m) => m.targets.includes(target));
      if (has.length === 0 || has.length === members.length) continue;
      for (const m of members.filter((m) => !m.targets.includes(target))) {
        flags.push({
          key: m.key,
          tone: "warn",
          message: `Missing from ${target}, while ${has.map((h) => h.key).join(", ")} ${has.length === 1 ? "is" : "are"} set there (other ${prefix}_* vars).`,
        });
      }
    }
  }

  return flags;
}

function toEnvRow(v: VercelEnvVar): EnvRow {
  return {
    key: v.key,
    type: v.type,
    targets: ENV_ORDER.filter((t) => v.target?.includes(t)),
    updatedAt: v.updatedAt ? new Date(v.updatedAt).toISOString() : null,
  };
}

function isOn(flag?: { enabledAt?: number; disabledAt?: number }): boolean {
  return !!flag?.enabledAt && !(flag.disabledAt && flag.disabledAt > flag.enabledAt);
}

async function fetchVercelConfig(): Promise<CachedResult<VercelConfig>> {
  const fetchedAt = new Date().toISOString();
  const scope = getVercelScope();
  if (!scope) return { data: EMPTY_CONFIG, fetchedAt };

  try {
    const [project, projectDomains] = await Promise.all([fetchProject(scope), fetchProjectDomains(scope)]);

    const domains = await Promise.all(
      projectDomains.map(async (d): Promise<DomainRow> => {
        const base: DomainRow = {
          name: d.name,
          verified: d.verified,
          redirectTo: d.redirect ?? null,
          misconfigured: null,
          configuredBy: null,
          nameservers: [],
          expiresAt: null,
          autoRenew: null,
          expiringSoon: false,
        };
        // *.vercel.app and redirect-only domains need no DNS/registration check.
        if (d.redirect || d.name.endsWith(".vercel.app")) return base;

        const [config, info] = await Promise.all([
          fetchDomainConfig(scope, d.name).catch(() => null),
          fetchDomainInfo(scope, d.name).catch(() => null),
        ]);
        const expiresAt = info?.expiresAt ? new Date(info.expiresAt).toISOString() : null;
        const expiringSoon =
          expiresAt != null &&
          new Date(expiresAt).getTime() - Date.now() < DOMAIN_EXPIRY_WARN_DAYS * DAY_MS &&
          info?.renew !== true;
        return {
          ...base,
          misconfigured: config?.misconfigured ?? null,
          configuredBy: config?.configuredBy ?? null,
          nameservers: config?.nameservers ?? [],
          expiresAt,
          autoRenew: info?.renew ?? null,
          expiringSoon,
        };
      })
    );

    const env = project.env.map(toEnvRow).sort((a, b) => a.key.localeCompare(b.key));

    return {
      data: {
        connected: true,
        error: null,
        env,
        envFlags: findEnvFlags(env),
        // Primary (non-redirect) domains first.
        domains: domains.sort((a, b) => Number(!!a.redirectTo) - Number(!!b.redirectTo)),
        webAnalyticsOn: isOn(project.webAnalytics),
        speedInsightsOn: isOn(project.speedInsights),
      },
      fetchedAt,
    };
  } catch (err) {
    console.error("Vercel: project config fetch failed", err);
    return {
      data: { ...EMPTY_CONFIG, connected: true, error: "Couldn't load project settings from Vercel." },
      fetchedAt,
    };
  }
}

export const getVercelConfig = unstable_cache(fetchVercelConfig, ["hq-vercel-config"], {
  revalidate: 3600,
  tags: TAGS,
});
