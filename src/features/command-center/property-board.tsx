"use client";

import * as React from "react";
import Link from "next/link";
import { KpiCard, KpiStrip } from "@/components/ui/kpi-card";
import { SectionHeader } from "@/components/ui/section-header";
import { ChartCard } from "@/components/ui/card";
import { ProgressRing } from "@/components/ui/progress-ring";
import { AnalyticsPanel } from "@/components/ui/analytics-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { PALETTE } from "./charts";
import { AttentionFeed, type AttentionRow } from "./attention-feed";
import { InsightList, type InsightView } from "./insight-list";
import { ComplianceBreakdown, type CategoryComplianceView } from "./compliance-breakdown";
import { FilterChip } from "./filter-chip";
import {
  PanelHeadline,
  TaskBreakdown,
  type TaskRecordView,
  type TaskTrendPoint,
} from "./task-breakdown";
import { cn } from "@/lib/utils";

export interface PropertyKpis {
  completed: number;
  completedPrev: number | null;
  inProcess: number;
  inProcessPrev: number | null;
  compliancePct: number | null;
  compliancePrevPct: number | null;
  complianceDeltaPp: number | null;
  complianceClean: number;
  complianceFlagged: number;
  complianceTotal: number;
  openIssues: number;
  openIssuesPrev: number;
  photos: number;
  photosPrev: number | null;
  completionPct: number | null;
}

type PanelKey = "completed" | "inProcess" | "compliance" | "issues" | "photos" | null;
type SeverityFilter = "ALL" | "CRITICAL_HIGH" | "STALE" | "NO_EVIDENCE";

/**
 * Property-level executive board: dark KPI surfaces, deterministic insights,
 * and the same drill-down grammar as the portfolio (KPI → breakdown →
 * category → record → evidence, §4).
 */
export function PropertyBoard({
  propertyCode,
  propertyName,
  week,
  weekLabel,
  hasPrevWeekData,
  previewOn,
  kpis,
  trend,
  tasks,
  attention,
  categoryCompliance,
  insights,
}: {
  propertyCode: string;
  propertyName: string;
  week: string;
  weekLabel: string;
  hasPrevWeekData: boolean;
  previewOn: boolean;
  kpis: PropertyKpis;
  trend: TaskTrendPoint[];
  tasks: TaskRecordView[];
  attention: AttentionRow[];
  categoryCompliance: CategoryComplianceView[];
  insights: InsightView[];
}) {
  const [panel, setPanel] = React.useState<PanelKey>(null);
  const [focus, setFocus] = React.useState<Exclude<PanelKey, null> | null>(null);
  const [severity, setSeverity] = React.useState<SeverityFilter>("ALL");

  const openPanel = (key: Exclude<PanelKey, null>) => {
    setFocus((f) => (f === key ? null : key));
    setPanel(key);
  };

  const filteredAttention = React.useMemo(() => {
    switch (severity) {
      case "CRITICAL_HIGH":
        return attention.filter((a) => a.severity === "CRITICAL" || a.severity === "HIGH");
      case "STALE":
        return attention.filter((a) => a.ageDays >= 3);
      case "NO_EVIDENCE":
        return attention.filter((a) => a.evidence.length === 0);
      default:
        return attention;
    }
  }, [attention, severity]);

  const panelMetric = panel === "completed" ? "COMPLETED" : "IN_PROCESS";
  const panelTasks = tasks.filter((t) => t.status === panelMetric);

  const severityFilters: Array<{ key: SeverityFilter; label: string; count: number }> = [
    { key: "ALL", label: "All", count: attention.length },
    {
      key: "CRITICAL_HIGH",
      label: "Critical & high",
      count: attention.filter((a) => a.severity === "CRITICAL" || a.severity === "HIGH").length,
    },
    { key: "STALE", label: "Open 3+ days", count: attention.filter((a) => a.ageDays >= 3).length },
    {
      key: "NO_EVIDENCE",
      label: "No photo",
      count: attention.filter((a) => a.evidence.length === 0).length,
    },
  ];

  return (
    <>
      <KpiStrip className="mb-6">
        <KpiCard
          label="Completed"
          value={kpis.completed}
          icon="check"
          variant="primary"
          tone="green"
          testId="kpi-completed"
          active={focus === "completed"}
          onClick={() => openPanel("completed")}
          delta={
            hasPrevWeekData && kpis.completedPrev !== null
              ? { value: kpis.completed - kpis.completedPrev, label: "vs last week" }
              : null
          }
          noComparison={!hasPrevWeekData || kpis.completedPrev === null}
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
            hasPrevWeekData && kpis.inProcessPrev !== null
              ? { value: kpis.inProcess - kpis.inProcessPrev, label: "vs last week", invert: true }
              : null
          }
          noComparison={!hasPrevWeekData || kpis.inProcessPrev === null}
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
          label="Open Issues"
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
          label="Photos Logged"
          value={kpis.photos}
          icon="camera"
          variant="primary"
          tone="green"
          testId="kpi-photos"
          active={focus === "photos"}
          onClick={() => openPanel("photos")}
          delta={
            hasPrevWeekData && kpis.photosPrev !== null
              ? { value: kpis.photos - kpis.photosPrev, label: "vs last week" }
              : null
          }
          noComparison={!hasPrevWeekData || kpis.photosPrev === null}
        />
      </KpiStrip>

      {insights.length > 0 ? (
        <>
          <SectionHeader
            title="Insights"
            icon="activity"
            description={`Computed from ${propertyName}'s ${previewOn ? "approved and published" : "published"} records for ${weekLabel}.`}
          />
          <InsightList
            insights={insights}
            className="mb-8"
            onFocus={(f) => {
              if (f.kind === "issues") setPanel("issues");
              else if (f.kind === "compliance") setPanel("compliance");
              else if (f.kind === "tasks") setPanel(f.value === "inProcess" ? "inProcess" : "completed");
            }}
          />
        </>
      ) : null}

      <SectionHeader
        title="Attention required"
        icon="warning"
        description="Unresolved checklist issues for this reporting week — most serious first."
        actions={
          attention.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {severityFilters.map((f) => (
                <FilterChip
                  key={f.key}
                  active={severity === f.key}
                  count={f.count}
                  onClick={() => setSeverity(severity === f.key ? "ALL" : f.key)}
                >
                  {f.label}
                </FilterChip>
              ))}
            </div>
          ) : null
        }
      />
      <AttentionFeed
        rows={filteredAttention}
        showProperty={false}
        limit={5}
        emptyTitle={
          severity === "ALL"
            ? `No open checklist issues for ${propertyName} this week`
            : "No issues match this filter"
        }
        emptyDetail="Flagged checklist points and their evidence appear here as soon as they are published."
      />

      <SectionHeader className="mt-8" title="Weekly performance" icon="clipboard" />
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Task completion" question="How much of this week's work is finished?">
          {kpis.completed + kpis.inProcess > 0 ? (
            <div className="flex flex-wrap items-center gap-5">
              <ProgressRing
                value={kpis.completionPct}
                caption="Done"
                ariaLabel={`Task completion ${kpis.completionPct ?? 0} percent`}
              />
              <div className="flex min-w-[140px] flex-col gap-1.5 text-[12.5px]">
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
                  color={PALETTE.c2}
                  label="Photos"
                  value={kpis.photos}
                  onClick={() => openPanel("photos")}
                />
              </div>
            </div>
          ) : (
            <EmptyState
              compact
              title={`No ${previewOn ? "approved" : "published"} weekly report for this week`}
              detail="Task metrics appear once the site's weekly report is approved and published."
            />
          )}
        </ChartCard>
        <ChartCard title="Checklist compliance" question="How clean were this week's checklists?">
          {kpis.complianceTotal > 0 ? (
            <div className="flex flex-wrap items-center gap-5">
              <ProgressRing
                value={kpis.compliancePct}
                caption="Clean"
                ariaLabel={`Checklist compliance ${kpis.compliancePct ?? 0} percent`}
              />
              <div className="flex min-w-[150px] flex-col gap-1.5 text-[12.5px]">
                <LegendButton
                  color={PALETTE.c1}
                  label="Clean points"
                  value={kpis.complianceClean}
                  onClick={() => openPanel("compliance")}
                />
                <LegendButton
                  color={PALETTE.red}
                  label="Flagged points"
                  value={kpis.complianceFlagged}
                  onClick={() => openPanel("issues")}
                />
                <LegendButton
                  color={PALETTE.track}
                  label="Total points"
                  value={kpis.complianceTotal}
                  onClick={() => openPanel("compliance")}
                />
              </div>
            </div>
          ) : (
            <EmptyState
              compact
              title="No published checklist points this week"
              detail="Compliance is computed from the checklist points recorded in published daily entries."
            />
          )}
        </ChartCard>
      </div>

      <AnalyticsPanel
        open={panel !== null}
        onClose={() => setPanel(null)}
        title={panelTitle(panel)}
        subtitle={weekLabel}
        breadcrumb={["Portfolio", propertyName, panelTitle(panel)]}
        width={panel === "compliance" || panel === "issues" ? "lg" : "md"}
      >
        {panel === "issues" ? (
          <>
            <PanelHeadline
              value={attention.length}
              caption={`open ${attention.length === 1 ? "issue" : "issues"} for ${propertyName}`}
            />
            <div className="mt-3 mb-3 flex flex-wrap items-center gap-1.5">
              {severityFilters.map((f) => (
                <FilterChip
                  key={f.key}
                  active={severity === f.key}
                  count={f.count}
                  onClick={() => setSeverity(severity === f.key ? "ALL" : f.key)}
                >
                  {f.label}
                </FilterChip>
              ))}
            </div>
            <AttentionFeed
              rows={filteredAttention}
              showProperty={false}
              emptyTitle="No issues match this filter"
              emptyDetail={`Flagged checklist points for ${propertyName} in ${weekLabel} appear here.`}
            />
          </>
        ) : panel === "compliance" ? (
          <ComplianceBreakdown
            headline={kpis.compliancePct}
            clean={kpis.complianceClean}
            flagged={kpis.complianceFlagged}
            total={kpis.complianceTotal}
            deltaPp={kpis.complianceDeltaPp}
            previousPct={kpis.compliancePrevPct}
            categories={categoryCompliance}
            byProperty={[]}
            issues={attention}
          />
        ) : panel === "photos" ? (
          <div>
            <PanelHeadline value={kpis.photos} caption={`photos logged for ${propertyName}`} />
            <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
              Progress photographs published for {weekLabel}. Checklist evidence photographs stay
              attached to their own checklist point and are shown from the issue that raised them.
            </p>
            <Link
              href={`/command-center/photos?week=${week}&property=${propertyCode}`}
              className="mt-4 inline-flex items-center gap-1.5 rounded-input border border-line bg-panel2 px-3 py-2 text-[12.5px] font-bold text-accent-dark transition-colors hover:bg-accent-light"
            >
              Open the {propertyName} album →
            </Link>
          </div>
        ) : panel !== null ? (
          <TaskBreakdown
            tasks={panelTasks}
            allTasks={panelTasks}
            trend={trend}
            metric={panel === "completed" ? "completed" : "inProcess"}
            weekLabel={weekLabel}
            showProperty={false}
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
      return "Open issues";
    case "photos":
      return "Photos logged";
    default:
      return "";
  }
}

function LegendButton({
  color,
  label,
  value,
  onClick,
  className,
}: {
  color: string;
  label: string;
  value: number;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-9 items-center gap-2 rounded-input px-2 py-1.5 text-start transition-colors hover:bg-panel2 sm:min-h-0 sm:px-1.5 sm:py-1",
        className,
      )}
    >
      <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: color }} aria-hidden />
      <span className="flex-1 text-ink">{label}</span>
      <b className="font-mono">{value}</b>
    </button>
  );
}
