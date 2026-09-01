"use client";

import * as React from "react";
import { KpiCard, KpiStrip } from "@/components/ui/kpi-card";
import { SectionHeader } from "@/components/ui/section-header";
import { ChartCard } from "@/components/ui/card";
import { ProgressRing } from "@/components/ui/progress-ring";
import { AnalyticsPanel } from "@/components/ui/analytics-panel";
import { Donut, GroupedBar, PALETTE, TrendLine } from "./charts";
import { AttentionFeed, type AttentionRow } from "./attention-feed";
import { PropertyHealthCard, type PropertyHealth } from "./property-health-card";
import { cn } from "@/lib/utils";

export interface PortfolioKpis {
  completed: number;
  completedPrev: number;
  inProcess: number;
  inProcessPrev: number;
  compliancePct: number | null;
  complianceClean: number;
  complianceTotal: number;
  openIssues: number;
  openIssuesPrev: number;
  photos: number;
  photosPrev: number;
  completionPct: number | null;
}

type FocusKey = "completed" | "inProcess" | "compliance" | "issues" | "photos" | null;

/**
 * Portfolio board: KPI strip → property health → Attention Required →
 * performance. KPIs cross-filter the board (§4): selecting a metric highlights
 * the properties that drive it and opens its analytics panel.
 */
export function PortfolioBoard({
  weekLabel,
  kpis,
  trend,
  properties,
  attention,
}: {
  weekLabel: string;
  kpis: PortfolioKpis;
  trend: Array<{ week: string; completed: number; inProcess: number }>;
  properties: PropertyHealth[];
  attention: AttentionRow[];
}) {
  const [focus, setFocus] = React.useState<FocusKey>(null);
  const [panel, setPanel] = React.useState<FocusKey>(null);
  const [activeProperty, setActiveProperty] = React.useState<string | null>(null);

  const toggle = (key: Exclude<FocusKey, null>) => {
    setFocus((f) => (f === key ? null : key));
    setPanel(key);
  };

  const chartData = properties.map((p) => ({
    name: p.name,
    key: p.code,
    completed: p.completed,
    inProcess: p.inProcess,
  }));

  // Cross-filter: property list reacts to the selected KPI.
  const rankedProperties = React.useMemo(() => {
    const list = [...properties];
    if (focus === "issues") list.sort((a, b) => b.openIssues - a.openIssues);
    else if (focus === "completed") list.sort((a, b) => b.completed - a.completed);
    else if (focus === "inProcess") list.sort((a, b) => b.inProcess - a.inProcess);
    else if (focus === "compliance")
      list.sort((a, b) => (a.compliancePct ?? 101) - (b.compliancePct ?? 101));
    else if (focus === "photos") list.sort((a, b) => b.photos - a.photos);
    return list;
  }, [properties, focus]);

  const attentionRows = React.useMemo(
    () => (activeProperty ? attention.filter((a) => a.propertyCode === activeProperty) : attention),
    [attention, activeProperty],
  );

  return (
    <>
      <KpiStrip className="mb-6">
        <KpiCard
          label="Completed This Week"
          value={kpis.completed}
          icon="check"
          tone="green"
          testId="kpi-completed"
          active={focus === "completed"}
          onClick={() => toggle("completed")}
          delta={{ value: kpis.completed - kpis.completedPrev, label: "vs last week" }}
          sparkline={trend.map((t) => t.completed)}
        />
        <KpiCard
          label="In Process"
          value={kpis.inProcess}
          icon="loader"
          tone="orange"
          testId="kpi-in-process"
          active={focus === "inProcess"}
          onClick={() => toggle("inProcess")}
          delta={{ value: kpis.inProcess - kpis.inProcessPrev, label: "vs last week", invert: true }}
          sparkline={trend.map((t) => t.inProcess)}
        />
        <KpiCard
          label="Checklist Compliance"
          value={kpis.compliancePct === null ? "—" : `${kpis.compliancePct}%`}
          icon="shield"
          tone={kpis.compliancePct !== null && kpis.compliancePct < 70 ? "orange" : "green"}
          testId="kpi-compliance"
          active={focus === "compliance"}
          onClick={() => toggle("compliance")}
          progress={kpis.compliancePct}
          hint={`${kpis.complianceClean} clean of ${kpis.complianceTotal} entries`}
        />
        <KpiCard
          label="Open Bottlenecks"
          value={kpis.openIssues}
          icon="alert"
          tone={kpis.openIssues > 0 ? "red" : "green"}
          testId="kpi-issues"
          active={focus === "issues"}
          onClick={() => toggle("issues")}
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
          tone="blue"
          testId="kpi-photos"
          active={focus === "photos"}
          onClick={() => toggle("photos")}
          delta={{ value: kpis.photos - kpis.photosPrev, label: "vs last week" }}
        />
      </KpiStrip>

      <SectionHeader
        title="Property health"
        icon="chart"
        description={
          focus
            ? "Ranked by the selected metric — click the metric again to clear."
            : "Each card drills into the property command center."
        }
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rankedProperties.map((p) => (
          <PropertyHealthCard key={p.code} p={p} />
        ))}
      </div>

      <SectionHeader
        className="mt-8"
        title="Attention required"
        icon="warning"
        description={
          activeProperty
            ? `Filtered to ${properties.find((p) => p.code === activeProperty)?.name ?? activeProperty}.`
            : "Unresolved checklist issues this week — most serious first."
        }
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterChip active={!activeProperty} onClick={() => setActiveProperty(null)}>
              All
            </FilterChip>
            {properties.map((p) => (
              <FilterChip
                key={p.code}
                active={activeProperty === p.code}
                onClick={() => setActiveProperty(activeProperty === p.code ? null : p.code)}
                count={attention.filter((a) => a.propertyCode === p.code).length}
              >
                {p.name}
              </FilterChip>
            ))}
          </div>
        }
      />
      <AttentionFeed
        rows={attentionRows}
        limit={6}
        emptyTitle={
          activeProperty
            ? "No open issues for this property this week"
            : "No critical operational issues require attention this week"
        }
        emptyDetail={`Checklist defects raised during ${weekLabel} would appear here with their evidence.`}
      />

      <SectionHeader className="mt-8" title="Portfolio performance" icon="chart" />
      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <ChartCard
          title="Completed vs In Process"
          question="Which property is carrying the most unfinished work?"
        >
          <GroupedBar
            data={chartData}
            contextLabel={weekLabel}
            activeKey={activeProperty}
            onSelect={(key) => setActiveProperty((cur) => (cur === key ? null : key))}
          />
        </ChartCard>
        <ChartCard title="Portfolio completion" question="How much of this week's work is done?">
          <div className="flex flex-wrap items-center gap-5">
            <ProgressRing
              value={kpis.completionPct}
              caption="Done"
              ariaLabel={`Portfolio task completion ${kpis.completionPct ?? 0} percent`}
            />
            <div className="flex min-w-[130px] flex-col gap-2 text-[12.5px]">
              <LegendRow color={PALETTE.c1} label="Completed" value={kpis.completed} />
              <LegendRow color={PALETTE.c3} label="In Process" value={kpis.inProcess} />
              <LegendRow
                color={PALETTE.track}
                label="Compliance"
                value={kpis.compliancePct === null ? "—" : `${kpis.compliancePct}%`}
              />
            </div>
          </div>
        </ChartCard>
      </div>

      {/* KPI analytics panels (§4 slide-in) */}
      <AnalyticsPanel
        open={panel !== null}
        onClose={() => setPanel(null)}
        title={panelTitle(panel)}
        subtitle={weekLabel}
        breadcrumb={["Portfolio", panelTitle(panel)]}
      >
        {panel === "issues" ? (
          <AttentionFeed
            rows={attention}
            emptyTitle="No open issues this week"
            emptyDetail="Nothing is currently flagged across the portfolio."
          />
        ) : panel === "compliance" ? (
          <div>
            <Donut
              slices={[
                { name: "Clean", value: kpis.complianceClean, color: PALETTE.c1 },
                {
                  name: "Flagged",
                  value: kpis.complianceTotal - kpis.complianceClean,
                  color: PALETTE.red,
                },
              ]}
              centerValue={kpis.compliancePct === null ? "—" : `${kpis.compliancePct}%`}
              centerLabel="Clean"
              contextLabel={weekLabel}
            />
            <ul className="mt-4 divide-y divide-line rounded-tile border border-line">
              {properties.map((p) => (
                <li key={p.code} className="flex items-center justify-between px-3 py-2 text-[12.5px]">
                  <span className="font-semibold text-ink">{p.name}</span>
                  <span className="font-mono">{p.compliancePct === null ? "—" : `${p.compliancePct}%`}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : panel === "photos" ? (
          <ul className="divide-y divide-line rounded-tile border border-line">
            {properties.map((p) => (
              <li key={p.code} className="flex items-center justify-between px-3 py-2 text-[12.5px]">
                <span className="font-semibold text-ink">{p.name}</span>
                <span className="font-mono">{p.photos} photos</span>
              </li>
            ))}
          </ul>
        ) : (
          <div>
            <TrendLine
              data={trend as unknown as Array<Record<string, string | number>>}
              xKey="week"
              yKey={panel === "inProcess" ? "inProcess" : "completed"}
              label={panel === "inProcess" ? "In Process" : "Completed"}
              color={panel === "inProcess" ? PALETTE.c3 : PALETTE.c1}
              contextLabel="Weekly trend"
              ariaLabel="Weekly task trend"
              formatX={(w) => w.slice(5)}
            />
            <ul className="mt-4 divide-y divide-line rounded-tile border border-line">
              {properties.map((p) => (
                <li key={p.code} className="flex items-center justify-between px-3 py-2 text-[12.5px]">
                  <span className="font-semibold text-ink">{p.name}</span>
                  <span className="font-mono">
                    {panel === "inProcess" ? p.inProcess : p.completed}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </AnalyticsPanel>
    </>
  );
}

function panelTitle(key: FocusKey): string {
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

function LegendRow({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: color }} aria-hidden />
      <span className="flex-1 text-ink">{label}</span>
      <b className="font-mono">{value}</b>
    </span>
  );
}

function FilterChip({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors",
        active
          ? "border-transparent bg-accent text-white"
          : "border-line bg-panel text-muted hover:text-ink",
      )}
    >
      {children}
      {typeof count === "number" && count > 0 ? (
        <span
          className={cn(
            "rounded-full px-1.5 font-mono text-[10px]",
            active ? "bg-white/20" : "bg-panel2",
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}
