import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/server/auth/session";
import { getPropertyByCode } from "@/server/permissions";
import { canReview } from "@/lib/roles";
import {
  attentionFeed,
  lastPublishedAt,
  bottlenecksForProperty,
  propertyWeekStats,
  PREVIEW,
  PUBLISHED_ONLY,
  taskTrend,
  tasksForProperty,
} from "@/server/services/metrics-service";
import {
  complianceByCategory,
  complianceSnapshot,
  flaggedPoints,
} from "@/server/services/checklist-compliance-service";
import { buildPropertyInsights } from "@/server/services/insights-service";
import {
  listKnownWeeks,
  resolveSelectedWeek,
  weekDataState,
} from "@/server/services/reporting-week-service";
import {
  propOneTrendsForProperty,
  propOneWidgetsForProperty,
} from "@/server/services/propone-service";
import { weeklyPhotosForWeek } from "@/server/services/media-service";
import { buildPropOneDomains } from "@/features/command-center/propone-mapper";
import { PropOneSection } from "@/features/command-center/propone-section";
import { BottleneckTable } from "@/features/command-center/bottleneck-table";
import { AlbumGallery } from "@/features/command-center/album-gallery";
import { PropertyBoard } from "@/features/command-center/property-board";
import { PageHeader } from "@/components/shell/page-header";
import { ReportingControls, PreviewNotice } from "@/components/shell/reporting-controls";
import { ModeSwitcher } from "@/components/theme/mode-switcher";
import { SectionHeader } from "@/components/ui/section-header";
import { Card } from "@/components/ui/card";
import { TrackingBadge, TaskStatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { taskCompletionPct } from "@/lib/metrics";
import { formatDateTime, formatEta } from "@/lib/utils";
import { addDays, weekEndOf, weekRangeLabel } from "@/lib/week";
import { localDateStr } from "@/lib/propone-metrics";
import { mediaUrl } from "@/lib/media-url";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ propertyCode: string }>;
}): Promise<Metadata> {
  const { propertyCode } = await params;
  const property = await getPropertyByCode(propertyCode);
  return { title: property ? `${property.name} · Command Center` : "Command Center" };
}

export default async function PropertyDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ propertyCode: string }>;
  searchParams: Promise<{ week?: string; preview?: string }>;
}) {
  const { propertyCode } = await params;
  const sp = await searchParams;
  const property = await getPropertyByCode(propertyCode);
  if (!property || !property.active) notFound();

  const user = await requirePageUser();
  const previewAllowed = canReview(user.role);
  const previewOn = previewAllowed && sp.preview === "1";
  const statuses = previewOn ? PREVIEW : PUBLISHED_ONLY;

  const week = await resolveSelectedWeek(sp.week);
  const prevWeek = addDays(week, -7);

  const [
    weeks,
    state,
    statsMap,
    prevStatsMap,
    compliance,
    categoryCompliance,
    flagged,
    prevFlagged,
    tasks,
    bottlenecks,
    attention,
    widgets,
    trends,
    photos,
    prevPhotos,
    publishedAt,
    trend,
  ] = await Promise.all([
    listKnownWeeks(),
    weekDataState(week, property.id),
    propertyWeekStats(week, statuses, [property.id]),
    propertyWeekStats(prevWeek, statuses, [property.id]),
    complianceSnapshot(week, statuses, [property.id]),
    complianceByCategory(week, statuses, [property.id]),
    flaggedPoints(week, statuses, [property.id]),
    flaggedPoints(prevWeek, statuses, [property.id]),
    tasksForProperty(property.id, week, statuses),
    bottlenecksForProperty(property.id, week, statuses),
    attentionFeed(week, statuses, { propertyIds: [property.id] }),
    propOneWidgetsForProperty(property.id, week),
    propOneTrendsForProperty(property.id),
    weeklyPhotosForWeek(week, statuses, property.id),
    weeklyPhotosForWeek(prevWeek, statuses, property.id),
    lastPublishedAt(property.id),
    taskTrend(week, statuses, 6, property.id),
  ]);

  const stats = statsMap.get(property.id) ?? null;
  const prevStats = prevStatsMap.get(property.id) ?? null;
  const completionPct = stats ? taskCompletionPct(stats.tasks) : null;
  const domains = buildPropOneDomains(widgets, trends, {
    today: localDateStr(new Date()),
    weekStart: week,
    weekEnd: weekEndOf(week),
  });

  const evidenceById = new Map(bottlenecks.map((b) => [b.responseId, b.evidence]));
  const attentionRows = attention.map((a) => ({
    responseId: a.responseId,
    propertyCode: property.code,
    propertyName: property.name,
    categoryName: a.categoryName,
    itemName: a.itemName,
    issue: a.issue,
    severity: a.severity,
    entryDate: a.entryDate,
    ageDays: a.ageDays,
    workflowStatus: a.workflowStatus,
    evidence: (evidenceById.get(a.responseId) ?? []).map((e) => ({
      id: e.id,
      url: mediaUrl(e.storageKey),
      thumbUrl: mediaUrl(e.thumbnailKey),
      caption: e.caption,
    })),
  }));

  const meta = [property.location, property.propertyType, property.areaLabel, property.developmentStatus]
    .filter(Boolean)
    .join(" · ");

  const hasPrevWeekData = prevStats !== null || compliance.previous.total > 0;

  const insights = buildPropertyInsights({
    propertyName: property.name,
    compliance: compliance.current,
    previousCompliancePct: compliance.previous.pct,
    flagged,
    completed: stats?.tasks.completed ?? 0,
    inProcess: stats?.tasks.inProcess ?? 0,
    previousCompleted: prevStats?.tasks.completed ?? null,
    photos: photos.length,
  });

  return (
    <div data-testid={`property-dashboard-${property.code}`}>
      {/* 1 — Sticky property header */}
      <PageHeader
        breadcrumb={[{ label: "Portfolio", href: "/command-center" }, { label: property.name }]}
        title={property.name}
        meta={
          <>
            {meta || "Master data pending — editable at Admin → Properties"} · {weekRangeLabel(week)}
            {publishedAt ? ` · last published ${formatDateTime(publishedAt)}` : ""}
          </>
        }
        controls={
          <>
            <TrackingBadge status={stats?.trackingStatus ?? null} />
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

      {/* 2 — Weekly management summary */}
      <Card className="mb-6 flex flex-wrap items-start gap-4 p-4">
        <div className="flex min-w-[132px] flex-col gap-1.5">
          <span className="t-label text-muted">Weekly status</span>
          <TrackingBadge status={stats?.trackingStatus ?? null} />
        </div>
        <div className="min-w-[240px] flex-1 border-s border-line ps-4">
          <span className="t-label text-muted">Management summary</span>
          <p className="mt-1 text-[13.5px] leading-relaxed text-ink">
            {stats?.summary?.trim()
              ? stats.summary
              : `No ${previewOn ? "approved" : "published"} weekly summary has been submitted for ${property.name} in ${weekRangeLabel(week)}.`}
          </p>
        </div>
      </Card>

      {/* 3–5 — Executive KPIs, insights, exceptions and weekly performance */}
      <PropertyBoard
        propertyCode={property.code}
        propertyName={property.name}
        week={week}
        weekLabel={weekRangeLabel(week)}
        hasPrevWeekData={hasPrevWeekData}
        previewOn={previewOn}
        kpis={{
          completed: stats?.tasks.completed ?? 0,
          completedPrev: prevStats?.tasks.completed ?? null,
          inProcess: stats?.tasks.inProcess ?? 0,
          inProcessPrev: prevStats?.tasks.inProcess ?? null,
          compliancePct: compliance.current.pct,
          compliancePrevPct: compliance.previous.pct,
          complianceDeltaPp: compliance.deltaPp,
          complianceClean: compliance.current.clean,
          complianceFlagged: compliance.current.flagged,
          complianceTotal: compliance.current.total,
          openIssues: flagged.length,
          openIssuesPrev: prevFlagged.length,
          photos: photos.length,
          photosPrev: prevStats ? prevPhotos.length : null,
          completionPct,
        }}
        trend={trend}
        tasks={tasks.map((t) => ({
          id: t.id,
          propertyCode: property.code,
          propertyName: property.name,
          task: t.task,
          status: t.status,
          etaDate: t.etaDate,
        }))}
        attention={attentionRows}
        categoryCompliance={categoryCompliance}
        insights={insights}
      />

      {/* 6 — PropOne */}
      <SectionHeader
        className="mt-8"
        title="PropOne"
        icon="plug"
        description="Live operational data synced from the PropOne warehouse."
      />
      <PropOneSection domains={domains} weekLabel={weekRangeLabel(week)} />

      {/* 7 — Weekly tasks */}
      <SectionHeader className="mt-8" title="Weekly tasks" icon="clipboard" />
      <Card className="overflow-hidden">
        {tasks.length > 0 ? (
          <div className="table-scroll">
            <table className="z-table" data-testid="task-table">
              <thead>
                <tr>
                  <th style={{ width: 44 }}>#</th>
                  <th>Task</th>
                  <th style={{ width: 130 }}>Status</th>
                  <th style={{ width: 150 }}>ETA / Completion</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t, i) => (
                  <tr key={t.id}>
                    <td className="font-mono text-[11px] text-muted">{String(i + 1).padStart(2, "0")}</td>
                    <td className="font-medium">{t.task}</td>
                    <td>
                      <TaskStatusBadge status={t.status} size="sm" />
                    </td>
                    <td className="font-mono text-[11.5px] text-muted">{formatEta(t.etaDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            compact
            title={`No ${previewOn ? "approved" : "published"} tasks for this reporting week`}
            detail={`Weekly tasks submitted by the ${property.name} site team appear here once published.`}
          />
        )}
      </Card>

      {/* 8 — Checklist bottlenecks (full detail table) */}
      <SectionHeader className="mt-8" title="Checklist bottlenecks" icon="alert" />
      <Card className="overflow-hidden">
        <BottleneckTable
          propertyName={property.name}
          rows={bottlenecks.map((b) => {
            const item = attention.find((a) => a.responseId === b.responseId);
            return {
              responseId: b.responseId,
              categoryName: b.categoryName,
              itemName: b.itemName,
              issue: b.issue,
              severity: b.severity,
              entryDate: b.entryDate,
              ageDays: item?.ageDays ?? 0,
              workflowStatus: item?.workflowStatus,
              evidence: b.evidence.map((e) => ({
                id: e.id,
                url: mediaUrl(e.storageKey),
                thumbUrl: mediaUrl(e.thumbnailKey),
                caption: e.caption,
              })),
            };
          })}
        />
      </Card>

      {/* 9 — Progress media */}
      <SectionHeader className="mt-8" title="Progress media" icon="images" />
      <AlbumGallery
        propertyName={property.name}
        photos={photos.map((p) => ({
          id: p.id,
          url: mediaUrl(p.storageKey),
          thumbUrl: mediaUrl(p.thumbnailKey),
          caption: p.caption,
          context: p.context,
        }))}
        emptyText={`No ${previewOn ? "approved or published" : "published"} progress photos for ${property.name} this week.`}
      />
    </div>
  );
}
