"use client";

import { useMemo, useState, useTransition } from "react";
import { Search, Download, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CustomerDetailPanel } from "./customer-detail-panel";
import { markExported } from "@/actions/exports";
import { formatCentsWhole, formatDate } from "@/lib/format";
import type { CustomerRow, SubscriptionStatus, SubscriptionTier } from "@/lib/types";

type SortKey = "name" | "signedUpAt" | "tier" | "status" | "lifetimeRevenueCents";
type SortDir = "asc" | "desc";

const STATUS_TONE: Record<string, "accent" | "warn" | "danger" | "neutral"> = {
  active: "accent",
  trialing: "neutral",
  past_due: "danger",
  canceled: "warn",
};

function statusLabel(status: SubscriptionStatus): string {
  if (!status) return "—";
  return status.replace("_", " ");
}

function csvField(value: string | number | null): string {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildCsv(rows: CustomerRow[]): string {
  const header = [
    "name",
    "email",
    "location",
    "signed_up",
    "tier",
    "status",
    "utm_source",
    "heard_about_us",
    "lifetime_revenue_usd",
  ].join(",");

  const lines = rows.map((c) =>
    [
      csvField(c.name),
      csvField(c.email),
      csvField(c.cityState),
      csvField(c.signedUpAt.slice(0, 10)),
      csvField(c.tier ?? "free"),
      csvField(c.status),
      csvField(c.utmSource),
      csvField(c.acqSource),
      csvField(c.lifetimeRevenueCents != null ? (c.lifetimeRevenueCents / 100).toFixed(2) : ""),
    ].join(",")
  );

  return [header, ...lines].join("\n");
}

export function CustomerTable({ customers }: { customers: CustomerRow[] }) {
  const [query, setQuery] = useState("");
  // Defaults to premium — the customers you usually care about; flip the
  // dropdown to "All tiers" for everyone.
  const [tierFilter, setTierFilter] = useState<SubscriptionTier | "all">("premium");
  const [statusFilter, setStatusFilter] = useState<SubscriptionStatus | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("signedUpAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<CustomerRow | null>(null);
  const [hideExported, setHideExported] = useState(false);
  const [isExporting, startExport] = useTransition();

  const sources = useMemo(() => {
    const set = new Set<string>();
    for (const c of customers) if (c.utmSource) set.add(c.utmSource);
    return Array.from(set).sort();
  }, [customers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = customers.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q) && !(c.email ?? "").toLowerCase().includes(q)) {
        return false;
      }
      if (tierFilter !== "all" && (c.tier ?? "free") !== tierFilter) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (sourceFilter !== "all" && c.utmSource !== sourceFilter) return false;
      if (hideExported && c.exportedAt) return false;
      return true;
    });

    rows = [...rows].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "signedUpAt":
          cmp = a.signedUpAt.localeCompare(b.signedUpAt);
          break;
        case "tier":
          cmp = (a.tier ?? "").localeCompare(b.tier ?? "");
          break;
        case "status":
          cmp = (a.status ?? "").localeCompare(b.status ?? "");
          break;
        case "lifetimeRevenueCents":
          cmp = (a.lifetimeRevenueCents ?? 0) - (b.lifetimeRevenueCents ?? 0);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return rows;
  }, [customers, query, tierFilter, statusFilter, sourceFilter, hideExported, sortKey, sortDir]);

  function handleExport() {
    if (filtered.length === 0) return;

    const csv = buildCsv(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nexus-customers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    // Record who was included so "hide exported" can filter them out of
    // the next batch. Fire-and-forget after the download starts.
    const ids = filtered.map((c) => c.id);
    startExport(async () => {
      try {
        await markExported(ids);
      } catch {
        // Export tracking failed (e.g. migration not run) — the CSV still
        // downloaded; nothing actionable client-side.
      }
    });
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function Th({ label, sortableKey }: { label: string; sortableKey?: SortKey }) {
    const active = sortableKey && sortKey === sortableKey;
    return (
      <th
        onClick={sortableKey ? () => toggleSort(sortableKey) : undefined}
        className={`px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted ${
          sortableKey ? "cursor-pointer select-none hover:text-ink" : ""
        }`}
      >
        {label}
        {active && <span className="ml-1 text-faint">{sortDir === "asc" ? "↑" : "↓"}</span>}
      </th>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or email…"
            className="w-full rounded-md border border-edge bg-surface-2 py-1.5 pl-8 pr-2 text-xs outline-none focus:border-edge-strong"
          />
        </div>
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value as SubscriptionTier | "all")}
          className="rounded-md border border-edge bg-surface-2 px-2 py-1.5 text-xs outline-none"
        >
          <option value="all">All tiers</option>
          <option value="free">Free</option>
          <option value="premium">Premium</option>
        </select>
        <select
          value={statusFilter ?? "all"}
          onChange={(e) =>
            setStatusFilter(e.target.value === "all" ? "all" : (e.target.value as SubscriptionStatus))
          }
          className="rounded-md border border-edge bg-surface-2 px-2 py-1.5 text-xs outline-none"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="trialing">Trialing</option>
          <option value="past_due">Past due</option>
          <option value="canceled">Canceled</option>
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="rounded-md border border-edge bg-surface-2 px-2 py-1.5 text-xs outline-none"
        >
          <option value="all">All sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-muted">
          <input
            type="checkbox"
            checked={hideExported}
            onChange={(e) => setHideExported(e.target.checked)}
            className="accent-accent"
          />
          hide exported
        </label>
        <span className="ml-auto text-xs text-faint">{filtered.length} of {customers.length}</span>
        <button
          type="button"
          onClick={handleExport}
          disabled={filtered.length === 0 || isExporting}
          className="flex items-center gap-1.5 rounded-md border border-edge bg-surface-2 px-2.5 py-1.5 text-xs text-ink transition-colors hover:border-edge-strong disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
          {isExporting ? "Recording…" : `Export CSV (${filtered.length})`}
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState label="No customers match these filters" />
      ) : (
        <div className="max-h-[480px] overflow-auto rounded-md border border-edge">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface-2">
              <tr>
                <Th label="Name" sortableKey="name" />
                <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted">
                  Location
                </th>
                <Th label="Signed up" sortableKey="signedUpAt" />
                <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted">
                  Source
                </th>
                <Th label="Tier" sortableKey="tier" />
                <Th label="Status" sortableKey="status" />
                <Th label="Lifetime revenue" sortableKey="lifetimeRevenueCents" />
                <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted">
                  Exported
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className="cursor-pointer border-t border-edge transition-colors hover:bg-surface-2"
                >
                  <td className="px-3 py-2">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-faint">{c.email}</p>
                  </td>
                  <td className="px-3 py-2 text-faint">{c.cityState || "—"}</td>
                  <td className="tnum px-3 py-2">{formatDate(c.signedUpAt)}</td>
                  <td className="px-3 py-2">
                    {c.isPreTracking ? (
                      <Badge tone="neutral">no attribution data</Badge>
                    ) : (
                      c.utmSource || "—"
                    )}
                  </td>
                  <td className="px-3 py-2 capitalize">{c.tier ?? "free"}</td>
                  <td className="px-3 py-2">
                    <Badge tone={STATUS_TONE[c.status ?? ""] ?? "neutral"}>
                      {statusLabel(c.status)}
                    </Badge>
                  </td>
                  <td className="tnum px-3 py-2">
                    {c.lifetimeRevenueCents != null ? formatCentsWhole(c.lifetimeRevenueCents) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {c.exportedAt ? (
                      <span
                        className="inline-flex items-center gap-1 text-accent"
                        title={`Exported ${formatDate(c.exportedAt)}`}
                      >
                        <Check className="h-3.5 w-3.5" strokeWidth={2} />
                      </span>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && <CustomerDetailPanel customer={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
