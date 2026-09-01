"use client";

import * as React from "react";
import { CalendarClock, ClipboardList, Film, Ticket, Users } from "lucide-react";
import { KpiCard, KpiStrip } from "@/components/ui/kpi-card";
import { ChartCard, Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState } from "@/components/ui/empty-state";
import { SourceStatusBadge } from "@/components/ui/status-badge";
import { StatusComposition, TrendLine, PALETTE } from "./charts";
import { formatNumber } from "@/lib/utils";

export interface PropOneTable {
  columns: string[];
  rows: string[][];
  statusColumn?: number;
}

export interface PropOneDomainView {
  key: "work-orders" | "visits" | "visitors" | "amenities" | "cinema" | "announcements" | "stickers";
  label: string;
  kpis: Array<{ label: string; value: string; tone?: "green" | "orange" | "red" | "blue" | "neutral" }>;
  composition?: Array<{ name: string; value: number; color: string }>;
  compositionTotal?: number;
  trend?: { data: Array<{ week: string; count: number }>; label: string };
  table?: PropOneTable;
  note?: string;
}

/**
 * PropOne section — tabbed instead of a stack of full-width panels (audit R4).
 * Overview shows the 4–6 metrics that matter; each domain tab carries its own
 * composition, trend (only with enough history) and drill-down table, with
 * status cross-filtering (§4).
 */
export function PropOneSection({
  domains,
  weekLabel,
}: {
  domains: PropOneDomainView[];
  weekLabel: string;
}) {
  const [tab, setTab] = React.useState<string>("overview");
  // Filter is stored per tab, so switching tabs naturally clears the filter
  // without a state-sync effect.
  const [filters, setFilters] = React.useState<Record<string, string | null>>({});
  const statusFilter = filters[tab] ?? null;
  const setStatusFilter = React.useCallback(
    (next: string | null | ((cur: string | null) => string | null)) =>
      setFilters((f) => ({
        ...f,
        [tab]: typeof next === "function" ? next(f[tab] ?? null) : next,
      })),
    [tab],
  );

  if (domains.length === 0) {
    return (
      <EmptyState
        icon="plug"
        title="No PropOne data is connected for this property"
        detail="A Manager/Admin can enable data domains and run a sync at Admin → Integrations."
      />
    );
  }

  const tabs = [
    { value: "overview", label: "Overview" },
    ...domains.map((d) => ({ value: d.key, label: d.label })),
  ];

  const active = domains.find((d) => d.key === tab) ?? null;

  return (
    <div data-testid="propone-section">
      <div className="mb-3.5 overflow-x-auto">
        <Segmented
          ariaLabel="PropOne data domain"
          value={tab}
          onChange={setTab}
          options={tabs}
          size="sm"
        />
      </div>

      {tab === "overview" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {domains.slice(0, 4).map((d) => (
            <Card key={d.key} className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-tile bg-accent-light text-accent-dark">
                  <DomainIcon domain={d.key} />
                </span>
                <h3 className="t-card">{d.label}</h3>
                <button
                  type="button"
                  onClick={() => setTab(d.key)}
                  className="ms-auto text-[11px] font-bold text-accent-dark hover:underline"
                >
                  View details
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {d.kpis.slice(0, 3).map((k) => (
                  <div key={k.label} className="rounded-tile bg-panel2 px-2.5 py-2">
                    <div className="t-label truncate text-muted">{k.label}</div>
                    <div className="mt-0.5 font-mono text-[17px] font-bold text-ink">{k.value}</div>
                  </div>
                ))}
              </div>
              {d.composition && d.compositionTotal ? (
                <div className="mt-3">
                  <StatusComposition rows={d.composition} total={d.compositionTotal} />
                </div>
              ) : d.trend && d.trend.data.length >= 4 ? (
                <div className="mt-2">
                  <TrendLine
                    data={d.trend.data as unknown as Array<Record<string, string | number>>}
                    xKey="week"
                    yKey="count"
                    label={d.trend.label}
                    height={120}
                    contextLabel={weekLabel}
                    ariaLabel={`${d.label} weekly trend`}
                    formatX={(w) => w.slice(5)}
                  />
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      ) : active ? (
        <div className="flex flex-col gap-4">
          <KpiStrip cols={active.kpis.length <= 4 ? 4 : 6}>
            {active.kpis.map((k) => (
              <KpiCard key={k.label} label={k.label} value={k.value} tone={k.tone ?? "neutral"} />
            ))}
          </KpiStrip>

          <div className="grid gap-4 lg:grid-cols-2">
            {active.composition && active.compositionTotal ? (
              <ChartCard
                title={`${active.label} — status composition`}
                question="Where is the volume sitting right now?"
              >
                <StatusComposition
                  rows={active.composition}
                  total={active.compositionTotal}
                  activeName={statusFilter}
                  onSelect={(name) => setStatusFilter((s) => (s === name ? null : name))}
                />
              </ChartCard>
            ) : null}
            {active.trend && active.trend.data.length >= 4 ? (
              <ChartCard
                title={`${active.label} — weekly trend`}
                question="Is activity rising or falling?"
              >
                <TrendLine
                  data={active.trend.data as unknown as Array<Record<string, string | number>>}
                  xKey="week"
                  yKey="count"
                  label={active.trend.label}
                  contextLabel={weekLabel}
                  ariaLabel={`${active.label} weekly trend`}
                  formatX={(w) => w.slice(5)}
                />
              </ChartCard>
            ) : null}
          </div>

          {active.table ? (
            <PropOneTableView
              table={active.table}
              statusFilter={statusFilter}
              onClearFilter={() => setStatusFilter(null)}
              label={active.label}
            />
          ) : null}

          {active.note ? (
            <p className="rounded-tile border border-line bg-panel px-3.5 py-2.5 text-[12px] text-muted">
              {active.note}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function DomainIcon({ domain }: { domain: PropOneDomainView["key"] }) {
  const cls = "h-3.5 w-3.5";
  switch (domain) {
    case "work-orders":
      return <ClipboardList className={cls} aria-hidden />;
    case "visits":
    case "visitors":
      return <Users className={cls} aria-hidden />;
    case "cinema":
      return <Film className={cls} aria-hidden />;
    case "stickers":
      return <Ticket className={cls} aria-hidden />;
    default:
      return <CalendarClock className={cls} aria-hidden />;
  }
}

function PropOneTableView({
  table,
  statusFilter,
  onClearFilter,
  label,
}: {
  table: PropOneTable;
  statusFilter: string | null;
  onClearFilter: () => void;
  label: string;
}) {
  const statusIdx = table.statusColumn;
  const rows =
    statusFilter && typeof statusIdx === "number"
      ? table.rows.filter((r) => r[statusIdx]?.toLowerCase() === statusFilter.toLowerCase())
      : table.rows;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
        <h3 className="t-card">{label} records</h3>
        <span className="font-mono text-[11px] text-muted">
          {formatNumber(rows.length)} shown
        </span>
        {statusFilter ? (
          <button
            type="button"
            onClick={onClearFilter}
            className="ms-auto inline-flex items-center gap-1.5 rounded-full border border-accent bg-accent-light px-2.5 py-1 text-[11px] font-bold text-accent-dark"
          >
            {statusFilter} ✕
          </button>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-6 text-center text-[12.5px] text-muted">
          No {label.toLowerCase()} match this filter.
        </div>
      ) : (
        <div className="max-h-[380px] overflow-auto">
          <table className="z-table">
            <thead className="sticky">
              <tr>
                {table.columns.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 100).map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) =>
                    j === statusIdx ? (
                      <td key={j}>
                        <SourceStatusBadge status={cell} />
                      </td>
                    ) : (
                      <td key={j} className="max-w-[240px] truncate">
                        {cell}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export { PALETTE };
