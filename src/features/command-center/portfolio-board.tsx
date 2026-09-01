"use client";

import * as React from "react";
import Link from "next/link";
import { KpiCard, KpiStrip } from "@/components/ui/kpi-card";
import { SectionHeader } from "@/components/ui/section-header";
import { ChartCard } from "@/components/ui/card";
import { ProgressRing } from "@/components/ui/progress-ring";
import { AnalyticsPanel } from "@/components/ui/analytics-panel";
import { GroupedBar, PALETTE } from "./charts";
import { AttentionFeed, type AttentionRow } from "./attention-feed";
import { PropertyHealthCard, type PropertyHealth } from "./property-health-card";
import { InsightList, type InsightView } from "./insight-list";
import { ComplianceBreakdown, type CategoryComplianceView } from "./compliance-breakdown";
import { FilterChip } from "./filter-chip";
import {
  PanelHeadline,
  TaskBreakdown,
  type TaskRecordView,
  type TaskTrendPoint,
} from "./task-breakdown";

export interface PortfolioKpis {
  completed: number;
  completedPrev: number;
  inProcess: number;
  inProcessPrev: number;
  compliancePct: number | null;
  compliancePrevPct: number | null;
  complianceDeltaPp: number | null;
  complianceClean: number;
  complianceFlagged: number;
  complianceTotal: number;
  openIssues: number;
  openIssuesPrev: number;
  photos: number;
  photosPrev: number;
  completionPct: number | null;
}

export type { TaskRecordView };

type PanelKey = "completed" | "inProcess" | "compliance" | "issues" | "photos" | null;

/**
 * Portfolio board. Every headline number leads to the underlying reason:
 * KPI → breakdown → property → category → record → evidence. Selecting a KPI
 * or a chart mark also cross-filters the board (§4).
 */
export function PortfolioBoard({
  week,
  weekLabel,
  hasPrevWeekData,
  kpis,
  trend,
  properties,
  attention,
  tasks,
  photoCounts,
  categoryCompliance,
  insights,
}: {
  week: string;
  weekLabel: string;
  hasPrevWeekData: boolean;
  kpis: PortfolioKpis;
  trend: TaskTrendPoint[];
  properties: PropertyHealth[];
  attention: AttentionRow[];
  tasks: TaskRecordView[];
  photoCounts: Array<{ propertyCode: string; propertyName: string; count: number }>;
  categoryCompliance: CategoryComplianceView[];
  insights: InsightView[];
}) {
  const [panel, setPanel] = React.useState<PanelKey>(null);
  const [focus, setFocus] = React.useState<Exclude<PanelKey, null> | null>(null);
  const [propertyFilter, setPropertyFilter] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<"COMPLETED" | "IN_PROCESS" | null>(null);

  const openPanel = (key: Exclude<PanelKey, null>) => {
    setFocus((f) => (f === key ? null : key));
    setPanel(key);
  };

  const rankedProperties = React.useMemo(() => {
    const list = [...properties];
    if (focus === "issues") list.sort((a, b) => b.openIssues - a.openIssues);
    else if (focus === "completed") list.sort((a, b) => b.completed - a.completed);
    else if (focus === "inProcess") list.sort((a, b) => b.inProcess - a.inProcess);
    else if (focus === "compliance") list.sort((a, b) => (a.compliancePct ?? 101) - (b.compliancePct ?? 101));
    else if (focus === "photos") list.sort((a, b) => b.photos - a.photos);
    return list;
  }, [properties, focus]);

  const filteredAttention = React.useMemo(
    () => (propertyFilter ? attention.filter((a) => a.propertyCode === propertyFilter) : attention),
    [attention, propertyFilter],
  );

  const activeFilterLabel = [
    propertyFilter ? (properties.find((p) => p.code === propertyFilter)?.name ?? propertyFilter) : null,
    statusFilter ? (statusFilter === "COMPLETED" ? "Completed" : "In Process") : null,
  ]
    .filter(Boolean)
    .join(" · ");

  function onBarSelect(propertyCode: string, series: "COMPLETED" | "IN_PROCESS") {
    const same = propertyFilter === propertyCode && statusFilter === series;
    setPropertyFilter(same ? null : propertyCode);
    setStatusFilter(same ? null : series);
    if (!same) setPanel(series === "COMPLETED" ? "completed" : "inProcess");
  }

  const panelMetric = panel === "completed" ? "COMPLETED" : "IN_PROCESS";
  const panelTasksAll = tasks.filter((t) => t.status === panelMetric);
  const panelTasks = propertyFilter
    ? panelTasksAll.filter((t) => t.propertyCode === propertyFilter)
    : panelTasksAll;

  return (
    <>
      <KpiStrip className="mb-6">
        <KpiCard
          label="Completed This Week"
          value={kpis.completed}
          icon="check"
          variant="primary"
          tone="green"
          testId="kpi-completed"
          active={focus === "completed"}
          onClick={() => openPanel("completed")}
          delta={hasPrevWeekData ? { value: kpis.completed - kpis.completedPrev, label: "vs last week" } : null}
          noComparison={!hasPrevWeekData}
          sparkline={trend.map((t) => t.completed)}
        />
        <KpiCard
          label="In Process"
          value={kpis.inProcess}
          icon="loader"
          variant="exception"
          tone="orange"
          testId="kpi-in-process"
          active={focus === "inProcess"}
          onClick={() => openPanel("inProcess")}
          delta={
            hasPrevWeekData
              ? { value: kpis.inProcess - kpis.inProcessPrev, label: "vs last week", invert: true }
              : null
          }
          noComparison={!hasPrevWeekData}
          sparkline={trend.map((t) => t.inProcess)}
        />
        <KpiCard
          label="Checklist Compliance"
          value={kpis.compliancePct === null ? "—" : `${kpis.compliancePct}%`}
          icon="shield"
          variant="primary"
          tone="green"
          testId="kpi-compliance"
          active={focus === "compliance"}
          onClick={() => openPanel("compliance")}
          progress={kpis.compliancePct}
          delta={
            kpis.complianceDeltaPp !== null
              ? { value: kpis.complianceDeltaPp, label: "vs last week", unit: "pp" }
              : null
          }
          noComparison={kpis.complianceDeltaPp === null && kpis.compliancePct !== null}
          hint={
            kpis.complianceTotal > 0
              ? `${kpis.complianceClean} clean · ${kpis.complianceFlagged} flagged · ${kpis.complianceTotal} points`
              : "No published checklist points this week"
          }
        />
        <KpiCard
          label="Open Bottlenecks"
          value={kpis.openIssues}
          icon="alert"
          variant="exception"
          tone="red"
          testId="kpi-issues"
          active={focus === "issues"}
          onClick={() => openPanel("issues")}
          delta={{
            value: kpis.openIssues - kpis.openIssuesPrev,
            label: "vs last week",
            invert: true,
            display:
              kpis.openIssuesPrev > kpis.openIssues
                ? `${kpis.openIssuesPrev - kpis.openIssues} resolved`
                : undefined,
          }}
        />
        <KpiCard
          label="Site Photos"
          value={kpis.photos}
          icon="camera"
          variant="primary"
          tone="green"
          testId="kpi-photos"
          active={focus === "photos"}
          onClick={() => openPanel("photos")}
          delta={hasPrevWeekData ? { value: kpis.photos - kpis.photosPrev, label: "vs last week" } : null}
          noComparison={!hasPrevWeekData}
        />
      </KpiStrip>

      {insights.length > 0 ? (
        <>
          <SectionHeader
            title="Insights"
            icon="activity"
            description="Computed from this week's published records — never estimated."
          />
          <InsightList
            insights={insights}
            className="mb-8"
            onFocus={(f) => {
              if (f.kind === "property" && f.value) setPropertyFilter(f.value);
              if (f.kind === "issues") setPanel("issues");
              if (f.kind === "compliance") setPanel("compliance");
              if (f.kind === "tasks") setPanel(f.value === "inProcess" ? "inProcess" : "completed");
            }}
          />
        </>
      ) : null}

      <SectionHeader
        title="Property health"
        icon="chart"
        description={
          focus
            ? "Ranked by the selected metric — click the metric again to clear."
            : "Every figure drills into its underlying records."
        }
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rankedProperties.map((p) => (
          <PropertyHealthCard
            key={p.code}
            p={p}
            week={week}
            onMetric={(metric) => {
              setPropertyFilter(p.code);
              if (metric === "completed") {
                setStatusFilter("COMPLETED");
                setPanel("completed");
              } else if (metric === "inProcess") {
                setStatusFilter("IN_PROCESS");
                setPanel("inProcess");
              } else if (metric === "compliance") {
                setPanel("compliance");
              } else if (metric === "issues") {
                setPanel("issues");
              } else {
                setPanel("photos");
              }
            }}
          />
        ))}
      </div>

      <SectionHeader
        className="mt-8"
        title="Attention required"
        icon="warning"
        description="Unresolved checklist issues this week — most serious first."
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterChip active={!propertyFilter} onClick={() => setPropertyFilter(null)}>
              All
            </FilterChip>
            {properties.map((p) => (
              <FilterChip
                key={p.code}
                active={propertyFilter === p.code}
                onClick={() => setPropertyFilter(propertyFilter === p.code ? null : p.code)}
                count={attention.filter((a) => a.propertyCode === p.code).length}
              >
                {p.name}
              </FilterChip>
            ))}
          </div>
        }
      />
      <AttentionFeed
        rows={filteredAttention}
        limit={6}
        emptyTitle={
          propertyFilter
            ? "No open issues for this property this week"
            : "No critical operational issues require attention this week"
        }
        emptyDetail={`Checklist defects raised during ${weekLabel} appear here with their evidence.`}
      />

      <SectionHeader className="mt-8" title="Portfolio performance" icon="chart" />
      {activeFilterLabel ? (
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[11.5px] text-muted">Filtered:</span>
          <FilterChip
            active
            onClick={() => {
              setPropertyFilter(null);
              setStatusFilter(null);
            }}
          >
            {activeFilterLabel} ✕
          </FilterChip>
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <ChartCard
          title="Completed vs In Process"
          question="Which property is carrying the most unfinished work?"
        >
          <GroupedBar
            data={properties.map((p) => ({
              name: p.name,
              key: p.code,
              completed: p.completed,
              inProcess: p.inProcess,
              prevCompleted: hasPrevWeekData ? (p.prevCompleted ?? null) : null,
              prevInProcess: hasPrevWeekData ? (p.prevInProcess ?? null) : null,
            }))}
            contextLabel={weekLabel}
            activeKey={propertyFilter}
            onSelect={onBarSelect}
          />
        </ChartCard>
        <ChartCard title="Portfolio completion" question="How much of this week's work is done?">
          <div className="flex flex-wrap items-center gap-5">
            <ProgressRing
              value={kpis.completionPct}
              caption="Done"
              ariaLabel={`Portfolio task completion ${kpis.completionPct ?? 0} percent`}
            />
            <div className="flex min-w-[150px] flex-col gap-1.5 text-[12.5px]">
              <LegendButton
                color={PALETTE.c1}
                label="Completed"
                value={kpis.completed}
                onClick={() => openPanel("completed")}
              />
              <LegendButton
                color={PALETTE.c3}
                label="In Process"
                value={kpis.inProcess}
                onClick={() => openPanel("inProcess")}
              />
              <LegendButton
                color={PALETTE.red}
                label="Open issues"
                value={kpis.openIssues}
                onClick={() => openPanel("issues")}
              />
            </div>
          </div>
        </ChartCard>
      </div>

      <AnalyticsPanel
        open={panel !== null}
        onClose={() => setPanel(null)}
        title={panelTitle(panel)}
        subtitle={weekLabel}
        breadcrumb={[
          "Portfolio",
          ...(propertyFilter
            ? [properties.find((p) => p.code === propertyFilter)?.name ?? propertyFilter]
            : []),
          panelTitle(panel),
        ]}
        width={panel === "compliance" || panel === "issues" ? "lg" : "md"}
      >
        {panel === "issues" ? (
          <AttentionFeed
            rows={filteredAttention}
            emptyTitle="No open issues this week"
            emptyDetail="Nothing is currently flagged across the portfolio."
          />
        ) : panel === "compliance" ? (
          <ComplianceBreakdown
            headline={kpis.compliancePct}
            clean={kpis.complianceClean}
            flagged={kpis.complianceFlagged}
            total={kpis.complianceTotal}
            deltaPp={kpis.complianceDeltaPp}
            previousPct={kpis.compliancePrevPct}
            categories={categoryCompliance}
            byProperty={properties.map((p) => ({
              code: p.code,
              name: p.name,
              pct: p.compliancePct,
              clean: p.complianceClean,
              flagged: p.complianceFlagged,
              total: p.complianceTotal,
            }))}
            issues={filteredAttention}
          />
        ) : panel === "photos" ? (
          <div>
            <PanelHeadline value={kpis.photos} caption="site photos published this week" />
            <ul className="mt-4 divide-y divide-line overflow-hidden rounded-tile border border-line">
              {photoCounts.length === 0 ? (
                <li className="px-3 py-6 text-center text-[12.5px] text-muted">
                  No progress photos were published for this reporting week.
                </li>
              ) : (
                photoCounts.map((p) => (
                  <li key={p.propertyCode}>
                    <Link
                      href={`/command-center/photos?week=${week}&property=${p.propertyCode}`}
                      className="flex items-center justify-between px-3 py-2.5 text-[12.5px] transition-colors hover:bg-panel2"
                    >
                      <span className="font-semibold text-ink">{p.propertyName}</span>
                      <span className="font-mono">{p.count} photos →</span>
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </div>
        ) : panel !== null ? (
          <TaskBreakdown
            tasks={panelTasks}
            allTasks={panelTasksAll}
            trend={trend}
            metric={panel === "completed" ? "completed" : "inProcess"}
            weekLabel={weekLabel}
            filterLabel={
              propertyFilter
                ? (properties.find((p) => p.code === propertyFilter)?.name ?? propertyFilter)
                : null
            }
            onClearFilter={() => {
              setPropertyFilter(null);
              setStatusFilter(null);
            }}
          />
        ) : null}
      </AnalyticsPanel>
    </>
  );
}

function panelTitle(key: PanelKey): string {
  switch (key) {
    case "completed":
      return "Completed this week";
    case "inProcess":
      return "In process";
    case "compliance":
      return "Checklist compliance";
    case "issues":
      return "Open bottlenecks";
    case "photos":
      return "Site photos";
    default:
      return "";
  }
}

function LegendButton({
  color,
  label,
  value,
  onClick,
}: {
  color: string;
  label: string;
  value: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-input px-1.5 py-1 text-start transition-colors hover:bg-panel2"
    >
      <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: color }} aria-hidden />
      <span className="flex-1 text-ink">{label}</span>
      <b className="font-mono">{value}</b>
    </button>
  );
}
