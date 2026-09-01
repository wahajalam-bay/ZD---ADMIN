import type { Metadata } from "next";
import { requirePageUser } from "@/server/auth/session";
import { canReview } from "@/lib/roles";
import {
  attentionFeed,
  complianceForWeek,
  lastPublishedAt,
  openIssueCounts,
  portfolioMetrics,
  PREVIEW,
  PUBLISHED_ONLY,
  taskTrend,
} from "@/server/services/metrics-service";
import {
  listKnownWeeks,
  resolveSelectedWeek,
  weekDataState,
} from "@/server/services/reporting-week-service";
import { PageHeader } from "@/components/shell/page-header";
import { ReportingControls, PreviewNotice } from "@/components/shell/reporting-controls";
import { ModeSwitcher } from "@/components/theme/mode-switcher";
import { SectionHeader } from "@/components/ui/section-header";
import { Icon, type IconName } from "@/components/ui/icon";
import { PortfolioBoard } from "@/features/command-center/portfolio-board";
import { addDays, weekRangeLabel } from "@/lib/week";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { mediaUrl } from "@/lib/media-url";

export const metadata: Metadata = { title: "Portfolio Overview" };
export const dynamic = "force-dynamic";

export default async function PortfolioOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; preview?: string; focus?: string }>;
}) {
  const params = await searchParams;
  const user = await requirePageUser();
  const previewAllowed = canReview(user.role);
  const previewOn = previewAllowed && params.preview === "1";
  const statuses = previewOn ? PREVIEW : PUBLISHED_ONLY;

  const week = await resolveSelectedWeek(params.week);
  const prevWeek = addDays(week, -7);

  const [weeks, state, metrics, prevMetrics, attention, issueCounts, prevIssueCounts, complianceMap, publishedAt, trend] =
    await Promise.all([
      listKnownWeeks(),
      weekDataState(week),
      portfolioMetrics(week, statuses),
      portfolioMetrics(prevWeek, statuses),
      attentionFeed(week, statuses),
      openIssueCounts(week, statuses),
      openIssueCounts(prevWeek, statuses),
      complianceForWeek(week, statuses),
      lastPublishedAt(),
      taskTrend(week, statuses, 6),
    ]);

  // Portfolio compliance = clean vs total published checklist entries.
  const complianceTotals = [...complianceMap.values()].reduce(
    (acc, c) => ({ clean: acc.clean + c.clean, total: acc.total + c.total }),
    { clean: 0, total: 0 },
  );
  const compliancePct =
    complianceTotals.total > 0
      ? Math.round((complianceTotals.clean / complianceTotals.total) * 100)
      : null;
  const prevOpenIssues = [...prevIssueCounts.values()].reduce((a, b) => a + b, 0);

  const properties = metrics.perProperty.map(({ property, stats, compliance }) => ({
    code: property.code,
    name: property.name,
    meta:
      [property.location, property.propertyType, property.areaLabel].filter(Boolean).join(" · ") ||
      "Master data pending",
    heroUrl: property.heroImageKey ? mediaUrl(property.heroImageKey) : null,
    tracking: stats?.trackingStatus ?? null,
    completed: stats?.tasks.completed ?? 0,
    inProcess: stats?.tasks.inProcess ?? 0,
    compliancePct: compliance.pct,
    openIssues: issueCounts.get(property.id) ?? 0,
    photos: stats?.photoCount ?? 0,
    summary: stats?.summary || null,
  }));

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
        weekLabel={weekRangeLabel(week)}
        kpis={{
          completed: metrics.tasks.completed,
          completedPrev: prevMetrics.tasks.completed,
          inProcess: metrics.tasks.inProcess,
          inProcessPrev: prevMetrics.tasks.inProcess,
          compliancePct,
          complianceClean: complianceTotals.clean,
          complianceTotal: complianceTotals.total,
          openIssues: attention.length,
          openIssuesPrev: prevOpenIssues,
          photos: metrics.sitePhotos,
          photosPrev: prevMetrics.sitePhotos,
          completionPct: metrics.completionPct,
        }}
        trend={trend}
        properties={properties}
        attention={attention.map((a) => ({
          responseId: a.responseId,
          propertyCode: a.propertyCode,
          propertyName: a.propertyName,
          categoryName: a.categoryName,
          itemName: a.itemName,
          issue: a.issue,
          severity: a.severity,
          entryDate: a.entryDate,
          ageDays: a.ageDays,
          workflowStatus: a.workflowStatus,
          evidence: [],
        }))}
      />

      <SectionHeader
        title="Reporting context"
        icon="property"
        className="mt-8"
        description={`Figures reflect ${previewOn ? "approved and published" : "published"} records for ${weekRangeLabel(week)} only — weeks are never mixed.`}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <ContextTile icon="check" label="Completed tasks" value={`${metrics.tasks.completed} this week`} />
        <ContextTile icon="loader" label="Still in process" value={`${metrics.tasks.inProcess} carried`} />
        <ContextTile
          icon="shield"
          label="Checklist entries measured"
          value={`${complianceTotals.total} published`}
        />
      </div>
    </div>
  );
}

function ContextTile({
  icon,
  label,
  value,
}: {
  icon: IconName;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-tile border border-line bg-panel px-3.5 py-2.5">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-tile bg-panel2 text-muted">
        <Icon name={icon} className="h-3.5 w-3.5" />
      </span>
      <span>
        <span className="block text-[12.5px] font-semibold text-ink">{value}</span>
        <span className="t-label text-muted">{label}</span>
      </span>
    </div>
  );
}
