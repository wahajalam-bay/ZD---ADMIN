import type { Metadata } from "next";
import { requirePageUser } from "@/server/auth/session";
import { canReview } from "@/lib/roles";
import {
  lastPublishedAt,
  photoCountsByProperty,
  portfolioMetrics,
  PREVIEW,
  PUBLISHED_ONLY,
  taskRecordsForWeek,
  taskTrend,
} from "@/server/services/metrics-service";
import {
  complianceByCategory,
  complianceSnapshot,
  flaggedPoints,
} from "@/server/services/checklist-compliance-service";
import { buildPortfolioInsights } from "@/server/services/insights-service";
import {
  listKnownWeeks,
  resolveSelectedWeek,
  weekDataState,
} from "@/server/services/reporting-week-service";
import { PageHeader } from "@/components/shell/page-header";
import { ReportingControls, PreviewNotice } from "@/components/shell/reporting-controls";
import { ModeSwitcher } from "@/components/theme/mode-switcher";
import { PortfolioBoard } from "@/features/command-center/portfolio-board";
import { addDays, weekRangeLabel } from "@/lib/week";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { mediaUrl } from "@/lib/media-url";

export const metadata: Metadata = { title: "Portfolio Overview" };
export const dynamic = "force-dynamic";

export default async function PortfolioOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; preview?: string }>;
}) {
  const params = await searchParams;
  const user = await requirePageUser();
  const previewAllowed = canReview(user.role);
  const previewOn = previewAllowed && params.preview === "1";
  const statuses = previewOn ? PREVIEW : PUBLISHED_ONLY;

  const week = await resolveSelectedWeek(params.week);
  const prevWeek = addDays(week, -7);

  const [
    weeks,
    state,
    metrics,
    prevMetrics,
    compliance,
    categoryCompliance,
    flagged,
    prevFlagged,
    tasks,
    photoCounts,
    publishedAt,
    trend,
  ] = await Promise.all([
    listKnownWeeks(),
    weekDataState(week),
    portfolioMetrics(week, statuses),
    portfolioMetrics(prevWeek, statuses),
    complianceSnapshot(week, statuses),
    complianceByCategory(week, statuses),
    flaggedPoints(week, statuses),
    flaggedPoints(prevWeek, statuses),
    taskRecordsForWeek(week, statuses),
    photoCountsByProperty(week, statuses),
    lastPublishedAt(),
    taskTrend(week, statuses, 6),
  ]);

  const issueByProperty = new Map<string, number>();
  for (const f of flagged) {
    issueByProperty.set(f.propertyCode, (issueByProperty.get(f.propertyCode) ?? 0) + 1);
  }

  const prevByProperty = new Map(
    prevMetrics.perProperty.map(({ property, stats }) => [property.code, stats]),
  );

  const properties = metrics.perProperty.map(({ property, stats, compliance: c }) => ({
    code: property.code,
    name: property.name,
    meta:
      [property.location, property.propertyType, property.areaLabel].filter(Boolean).join(" · ") ||
      "Master data pending",
    heroUrl: property.heroImageKey ? mediaUrl(property.heroImageKey) : null,
    tracking: stats?.trackingStatus ?? null,
    completed: stats?.tasks.completed ?? 0,
    inProcess: stats?.tasks.inProcess ?? 0,
    compliancePct: c.pct,
    complianceClean: c.clean,
    complianceFlagged: c.flagged,
    complianceTotal: c.total,
    openIssues: issueByProperty.get(property.code) ?? 0,
    photos: stats?.photoCount ?? 0,
    summary: stats?.summary || null,
    prevCompleted: prevByProperty.get(property.code)?.tasks.completed ?? null,
    prevInProcess: prevByProperty.get(property.code)?.tasks.inProcess ?? null,
  }));

  // Was there any comparable reporting last week? Drives delta suppression.
  const hasPrevWeekData = prevMetrics.perProperty.some((p) => p.stats !== null);

  const insights = buildPortfolioInsights({
    weekLabel: weekRangeLabel(week),
    properties: metrics.perProperty.map(({ property, stats, compliance: c }) => ({
      code: property.code,
      name: property.name,
      completed: stats?.tasks.completed ?? 0,
      inProcess: stats?.tasks.inProcess ?? 0,
      photos: stats?.photoCount ?? 0,
      openIssues: issueByProperty.get(property.code) ?? 0,
      compliance: c,
      hasReport: stats !== null,
    })),
    previous: {
      completed: hasPrevWeekData ? prevMetrics.tasks.completed : null,
      inProcess: hasPrevWeekData ? prevMetrics.tasks.inProcess : null,
      photos: hasPrevWeekData ? prevMetrics.sitePhotos : null,
      openIssues: prevFlagged.length,
      compliancePct: compliance.previous.pct,
    },
    current: {
      completed: metrics.tasks.completed,
      inProcess: metrics.tasks.inProcess,
      photos: metrics.sitePhotos,
      openIssues: flagged.length,
      compliancePct: compliance.current.pct,
    },
    flagged,
  });

  const areaLabel =
    metrics.area.complete && metrics.area.sum > 0
      ? `${formatNumber(metrics.area.sum)} Sft`
      : "area data incomplete";

  return (
    <div data-testid="portfolio-overview">
      <PageHeader
        eyebrow="Weekly Admin Properties Review"
        title="Portfolio Overview"
        meta={
          <>
            {weekRangeLabel(week)} · {metrics.propertyCount} properties · {areaLabel}
            {publishedAt ? ` · last published ${formatDateTime(publishedAt)}` : ""}
          </>
        }
        controls={
          <>
            <ReportingControls
              weeks={weeks}
              selected={week}
              dataState={previewOn && state === "PREVIEW" ? "PREVIEW" : state}
              canPreview={previewAllowed}
              previewOn={previewOn}
            />
            <ModeSwitcher showPresentation />
          </>
        }
      />

      {previewOn ? <PreviewNotice weekStart={week} /> : null}

      <PortfolioBoard
        week={week}
        weekLabel={weekRangeLabel(week)}
        hasPrevWeekData={hasPrevWeekData}
        kpis={{
          completed: metrics.tasks.completed,
          completedPrev: prevMetrics.tasks.completed,
          inProcess: metrics.tasks.inProcess,
          inProcessPrev: prevMetrics.tasks.inProcess,
          compliancePct: compliance.current.pct,
          compliancePrevPct: compliance.previous.pct,
          complianceDeltaPp: compliance.deltaPp,
          complianceClean: compliance.current.clean,
          complianceFlagged: compliance.current.flagged,
          complianceTotal: compliance.current.total,
          openIssues: flagged.length,
          openIssuesPrev: prevFlagged.length,
          photos: metrics.sitePhotos,
          photosPrev: prevMetrics.sitePhotos,
          completionPct: metrics.completionPct,
        }}
        trend={trend}
        properties={properties}
        attention={flagged.map((f) => ({
          responseId: f.responseId,
          propertyCode: f.propertyCode,
          propertyName: f.propertyName,
          categoryName: f.categoryName,
          itemName: f.itemName,
          issue: f.issue,
          severity: f.severity,
          entryDate: f.entryDate,
          ageDays: f.ageDays,
          workflowStatus: f.workflowStatus,
          evidence: [],
        }))}
        tasks={tasks}
        photoCounts={photoCounts}
        categoryCompliance={categoryCompliance}
        insights={insights}
      />
    </div>
  );
}
