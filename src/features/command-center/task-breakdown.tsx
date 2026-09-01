"use client";

import * as React from "react";
import { TaskStatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PALETTE, TrendLine } from "./charts";
import { FilterChip } from "./filter-chip";
import { formatEta } from "@/lib/utils";

export interface TaskRecordView {
  id: string;
  propertyCode: string;
  propertyName: string;
  task: string;
  status: "COMPLETED" | "IN_PROCESS";
  etaDate: string | null;
}

export interface TaskTrendPoint {
  week: string;
  completed: number;
  inProcess: number;
}

/** Big figure + caption used at the top of every drill-down panel. */
export function PanelHeadline({ value, caption }: { value: React.ReactNode; caption: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="font-mono text-[30px] leading-none font-bold text-ink">{value}</span>
      <span className="text-[12.5px] text-muted">{caption}</span>
    </div>
  );
}

/**
 * Task drill-down (§4): the headline count, its composition by property, the
 * weekly trend where enough history exists, and the individual task records
 * behind the number.
 */
export function TaskBreakdown({
  tasks,
  allTasks,
  trend,
  metric,
  weekLabel,
  filterLabel,
  onClearFilter,
  showProperty = true,
}: {
  /** Tasks after the active cross-filter. */
  tasks: TaskRecordView[];
  /** Tasks before the cross-filter — drives the headline and composition. */
  allTasks: TaskRecordView[];
  trend: TaskTrendPoint[];
  metric: "completed" | "inProcess";
  weekLabel: string;
  filterLabel?: string | null;
  onClearFilter?: () => void;
  showProperty?: boolean;
}) {
  const byProperty = new Map<string, { name: string; count: number }>();
  for (const t of allTasks) {
    const cur = byProperty.get(t.propertyCode) ?? { name: t.propertyName, count: 0 };
    cur.count += 1;
    byProperty.set(t.propertyCode, cur);
  }
  const hasTrend = trend.filter((t) => t[metric] > 0).length >= 2;

  return (
    <div data-testid={`panel-${metric}`}>
      <PanelHeadline
        value={allTasks.length}
        caption={metric === "completed" ? "tasks completed this week" : "tasks still in process"}
      />

      {showProperty && byProperty.size > 1 ? (
        <>
          <h3 className="t-label mt-5 mb-2 text-muted">By property</h3>
          <ul className="divide-y divide-line overflow-hidden rounded-tile border border-line">
            {[...byProperty.entries()].map(([code, v]) => (
              <li key={code} className="flex items-center justify-between px-3 py-2 text-[12.5px]">
                <span className="font-semibold text-ink">{v.name}</span>
                <span className="font-mono">{v.count}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {hasTrend ? (
        <>
          <h3 className="t-label mt-5 mb-1 text-muted">Weekly trend</h3>
          <TrendLine
            data={trend as unknown as Array<Record<string, string | number>>}
            xKey="week"
            yKey={metric}
            label={metric === "completed" ? "Completed" : "In Process"}
            color={metric === "completed" ? PALETTE.c1 : PALETTE.c3}
            height={150}
            contextLabel="Weekly trend"
            ariaLabel="Weekly task trend"
            formatX={(w) => w.slice(5)}
          />
        </>
      ) : (
        <p className="mt-4 rounded-tile border border-line bg-panel2 px-3 py-2 text-[11.5px] text-muted">
          Insufficient historical data for a trend.
        </p>
      )}

      <div className="mt-5 mb-2 flex items-center gap-2">
        <h3 className="t-label text-muted">Tasks</h3>
        {filterLabel && onClearFilter ? (
          <FilterChip active onClick={onClearFilter}>
            {filterLabel} ✕
          </FilterChip>
        ) : null}
      </div>
      {tasks.length === 0 ? (
        <EmptyState
          compact
          title={`No ${metric === "completed" ? "completed" : "in-process"} tasks for this selection`}
          detail={`Published weekly tasks for ${weekLabel} appear here.`}
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-tile border border-line">
          {tasks.map((t) => (
            <li key={t.id} className="px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[12.5px] font-semibold text-ink">{t.task}</span>
                <TaskStatusBadge status={t.status} size="sm" />
              </div>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-muted">
                {showProperty ? <span className="font-semibold">{t.propertyName}</span> : null}
                <span className="font-mono">
                  {t.status === "COMPLETED" ? "completed" : "ETA"} {formatEta(t.etaDate)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
