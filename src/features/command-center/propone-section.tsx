"use client";

import * as React from "react";
import { CalendarClock, ClipboardList, Film, Ticket, Users } from "lucide-react";
import { KpiCard, KpiStrip } from "@/components/ui/kpi-card";
import { ChartCard, Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState } from "@/components/ui/empty-state";
import { SourceStatusBadge } from "@/components/ui/status-badge";
import { StatusComposition, TrendLine, PALETTE } from "./charts";
import { FilterChip } from "./filter-chip";
import { formatNumber } from "@/lib/utils";

/**
 * How a PropOne headline number maps onto the underlying record table.
 * `statusNot` backs "other" buckets (everything the named statuses exclude);
 * `scope` backs the time-scoped visit counters.
 */
export type PropOneFilter =
  | { type: "status"; value: string; label?: string }
  | { type: "statusNot"; values: string[]; label?: string }
  | { type: "scope"; value: "today" | "week"; label?: string };

export interface PropOneKpi {
  label: string;
  value: string;
  tone?: "green" | "orange" | "red" | "blue" | "neutral";
  /** Clicking the KPI applies this filter to the records table. */
  filter?: PropOneFilter;
}

export interface PropOneTable {
  columns: string[];
  rows: string[][];
  statusColumn?: number;
  /** Per-row `YYYY-MM-DD` of the record's primary timestamp (scope filters). */
  rowDates?: Array<string | null>;
  period?: { today: string; weekStart: string; weekEnd: string };
  /** True when `rows` is a capped sample of a larger warehouse result. */
  sampled?: boolean;
}

export interface PropOneDomainView {
  key: "work-orders" | "visits" | "visitors" | "amenities" | "cinema" | "announcements" | "stickers";
  label: string;
  kpis: PropOneKpi[];
  composition?: Array<{ name: string; value: number; color: string; filter?: PropOneFilter }>;
  compositionTotal?: number;
  trend?: { data: Array<{ week: string; count: number }>; label: string };
  table?: PropOneTable;
  note?: string;
}

function filterLabel(f: PropOneFilter): string {
  if (f.label) return f.label;
  switch (f.type) {
    case "status":
      return f.value;
    case "statusNot":
      return "Other statuses";
    case "scope":
      return f.value === "today" ? "Today" : "This week";
  }
}

function sameFilter(a: PropOneFilter | null, b: PropOneFilter | null): boolean {
  if (!a || !b) return a === b;
  if (a.type !== b.type) return false;
  if (a.type === "status" && b.type === "status") return a.value === b.value;
  if (a.type === "scope" && b.type === "scope") return a.value === b.value;
  if (a.type === "statusNot" && b.type === "statusNot")
    return a.values.join("|") === b.values.join("|");
  return false;
}

function rowMatches(table: PropOneTable, f: PropOneFilter, index: number): boolean {
  const row = table.rows[index] ?? [];
  if (f.type === "status" || f.type === "statusNot") {
    if (typeof table.statusColumn !== "number") return true;
    const cell = (row[table.statusColumn] ?? "").trim().toLowerCase();
    return f.type === "status"
      ? cell === f.value.trim().toLowerCase()
      : !f.values.some((v) => v.trim().toLowerCase() === cell);
  }
  const day = table.rowDates?.[index] ?? null;
  if (!day || !table.period) return false;
  return f.value === "today"
    ? day === table.period.today
    : day >= table.period.weekStart && day <= table.period.weekEnd;
}

/**
 * PropOne section — tabbed instead of a stack of full-width panels (audit R4).
 * Overview shows the metrics that matter; each domain tab carries its own
 * composition, trend (only with enough history) and drill-down table. Every
 * headline number is clickable and filters the records beneath it (§4/§7).
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
  const [filters, setFilters] = React.useState<Record<string, PropOneFilter | null>>({});
  const activeFilter = filters[tab] ?? null;
  const toggleFilter = React.useCallback(
    (next: PropOneFilter | null) =>
      setFilters((f) => ({ ...f, [tab]: sameFilter(f[tab] ?? null, next) ? null : next })),
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
                  <button
                    key={k.label}
                    type="button"
                    data-testid={`propone-overview-${d.key}-${k.label.toLowerCase().replace(/\s+/g, "-")}`}
                    onClick={() => {
                      setTab(d.key);
                      if (k.filter) setFilters((f) => ({ ...f, [d.key]: k.filter! }));
                    }}
                    className="rounded-tile bg-panel2 px-2.5 py-2 text-start transition-colors hover:bg-accent-light"
                  >
                    <span className="t-label block truncate text-muted">{k.label}</span>
                    <span className="mt-0.5 block font-mono text-[17px] font-bold text-ink">
                      {k.value}
                    </span>
                  </button>
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
              <KpiCard
                key={k.label}
                label={k.label}
                value={k.value}
                tone={k.tone ?? "neutral"}
                testId={`propone-kpi-${active.key}-${k.label.toLowerCase().replace(/\s+/g, "-")}`}
                active={k.filter ? sameFilter(activeFilter, k.filter) : false}
                onClick={k.filter ? () => toggleFilter(k.filter!) : undefined}
              />
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
                  activeName={
                    activeFilter?.type === "status"
                      ? (active.composition.find((c) =>
                          sameFilter(c.filter ?? null, activeFilter),
                        )?.name ?? activeFilter.value)
                      : activeFilter?.type === "statusNot"
                        ? (active.composition.find((c) => sameFilter(c.filter ?? null, activeFilter))
                            ?.name ?? null)
                        : null
                  }
                  onSelect={(name) => {
                    const row = active.composition!.find((c) => c.name === name);
                    toggleFilter(row?.filter ?? { type: "status", value: name });
                  }}
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
              filter={activeFilter}
              onClearFilter={() => toggleFilter(null)}
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
  filter,
  onClearFilter,
  label,
}: {
  table: PropOneTable;
  filter: PropOneFilter | null;
  onClearFilter: () => void;
  label: string;
}) {
  const statusIdx = table.statusColumn;
  const rows = filter ? table.rows.filter((_, i) => rowMatches(table, filter, i)) : table.rows;

  return (
    <Card className="overflow-hidden" data-testid="propone-records">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
        <h3 className="t-card">{label} records</h3>
        <span className="font-mono text-[11px] text-muted">
          {formatNumber(rows.length)}
          {filter ? ` of ${formatNumber(table.rows.length)}` : ""} shown
          {table.sampled ? " · latest synced records" : ""}
        </span>
        {filter ? (
          <FilterChip active className="ms-auto" onClick={onClearFilter}>
            {filterLabel(filter)} ✕
          </FilterChip>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-6 text-center text-[12.5px] text-muted">
          None of the latest synced {label.toLowerCase()} match this filter.
        </div>
      ) : (
        <div className="max-h-[380px] overflow-auto">
          <table className="z-table z-table--exec">
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
