import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";
import { getPropertyByCode } from "@/server/permissions";
import { canReview } from "@/lib/roles";
import {
  bottlenecksForProperty,
  complianceForWeek,
  propertyWeekStats,
  PREVIEW,
  PUBLISHED_ONLY,
  tasksForProperty,
} from "@/server/services/metrics-service";
import {
  listKnownWeeks,
  resolveSelectedWeek,
  weekDataState,
} from "@/server/services/reporting-week-service";
import { propOneWidgetsForProperty } from "@/server/services/propone-service";
import { weeklyPhotosForWeek } from "@/server/services/media-service";
import { buildPropOneWidgetViews } from "@/features/command-center/propone-mapper";
import { PropOneWidgets } from "@/features/command-center/propone-widgets";
import { BottleneckTable } from "@/features/command-center/bottleneck-table";
import { DonutStat, CHART_COLORS } from "@/features/command-center/charts";
import { PhotoStrip } from "@/features/command-center/photo-strip";
import { WeekSelector } from "@/components/shell/week-selector";
import { Card } from "@/components/ui/card";
import { TaskStatusBadge, TrackingBadge, Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { taskCompletionPct } from "@/lib/metrics";
import { formatEta } from "@/lib/utils";
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

  const user = (await getSessionUser())!;
  const previewAllowed = canReview(user.role);
  const previewOn = previewAllowed && sp.preview === "1";
  const statuses = previewOn ? PREVIEW : PUBLISHED_ONLY;

  const week = await resolveSelectedWeek(sp.week);
  const [weeks, state, statsMap, complianceMap, tasks, bottlenecks, widgets, photos] =
    await Promise.all([
      listKnownWeeks(),
      weekDataState(week, property.id),
      propertyWeekStats(week, statuses, [property.id]),
      complianceForWeek(week, statuses, [property.id]),
      tasksForProperty(property.id, week, statuses),
      bottlenecksForProperty(property.id, week, statuses),
      propOneWidgetsForProperty(property.id, week),
      weeklyPhotosForWeek(week, statuses, property.id),
    ]);

  const stats = statsMap.get(property.id) ?? null;
  const compliance = complianceMap.get(property.id) ?? { total: 0, clean: 0, flagged: 0, pct: null };
  const completionPct = stats ? taskCompletionPct(stats.tasks) : null;
  const widgetViews = buildPropOneWidgetViews(widgets);

  return (
    <div data-testid={`property-dashboard-${property.code}`}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 text-[11.5px] font-semibold tracking-wider text-muted uppercase">
            Admin · Weekly Property Update
          </div>
          <h2 className="text-[22px] font-bold">{property.name}</h2>
          <div className="mt-2">
            <WeekSelector
              weeks={weeks}
              selected={week}
              dataState={previewOn && state === "PREVIEW" ? "PREVIEW" : state}
              canPreview={previewAllowed}
              previewOn={previewOn}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Badge className="bg-panel border border-line text-muted">📷 Site Images</Badge>
          <Badge className="bg-panel border border-line text-muted/60" title="No video submitted — video support is modeled but not yet enabled">
            🎥 Site Videos
          </Badge>
          <Badge className="bg-panel border border-line text-muted/60" title="No live camera feed configured">
            📡 Live Camera
          </Badge>
        </div>
      </div>

      <Card className="mb-2 px-5 py-4">
        <div className="text-[15px] font-bold">
          {[property.location, property.propertyType].filter(Boolean).join(" · ") ||
            "Property master data pending — editable at Admin → Properties"}
        </div>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {property.areaLabel ? (
            <Badge className="bg-accent-light text-accent-dark">{property.areaLabel}</Badge>
          ) : null}
          {property.developmentStatus ? (
            <Badge className="bg-accent-light text-accent-dark">{property.developmentStatus}</Badge>
          ) : null}
          <Badge className="bg-accent-light text-accent-dark">
            {stats?.tasks.completed ?? 0} completed this week
          </Badge>
          <Badge className="bg-accent-light text-accent-dark">
            {stats?.tasks.inProcess ?? 0} in process
          </Badge>
          <Badge className="bg-accent-light text-accent-dark">{photos.length} photos</Badge>
          <TrackingBadge status={stats?.trackingStatus ?? null} />
        </div>
        {stats?.summary ? (
          <p className="mt-3 border-t border-line pt-2.5 text-[13px] leading-relaxed">{stats.summary}</p>
        ) : null}
      </Card>

      <div className="secbar">
        <h3>PropOne Dashboard</h3>
        <div className="line" />
      </div>
      <PropOneWidgets widgets={widgetViews} />

      <div className="secbar">
        <h3>Status Overview</h3>
        <div className="line" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h4 className="mb-3 text-[12px] font-bold tracking-wide text-muted uppercase">
            Task Completion — {property.name}
          </h4>
          {stats ? (
            <DonutStat
              ariaLabel={`Task completion for ${property.name}`}
              slices={[
                { name: "Completed", value: stats.tasks.completed, color: CHART_COLORS.TEAL },
                { name: "In Process", value: stats.tasks.inProcess, color: CHART_COLORS.AMBER },
              ]}
              legendExtra={[{ name: "Photos logged", value: photos.length, color: CHART_COLORS.BLUE }]}
              centerValue={completionPct === null ? "—" : `${completionPct}%`}
              centerLabel="Done"
            />
          ) : (
            <EmptyState
              title={`No ${previewOn ? "approved or published" : "published"} weekly report for this week`}
              detail="Data appears here once the site's weekly report is approved and published."
            />
          )}
        </Card>
        <Card className="p-5">
          <h4 className="mb-3 text-[12px] font-bold tracking-wide text-muted uppercase">
            Checklist Compliance — {property.name}
          </h4>
          {compliance.total > 0 ? (
            <DonutStat
              ariaLabel={`Checklist compliance for ${property.name}`}
              slices={[
                { name: "Clean", value: compliance.clean, color: CHART_COLORS.TEAL },
                { name: "Flagged", value: compliance.flagged, color: CHART_COLORS.RED },
              ]}
              legendExtra={[{ name: "Total entries", value: compliance.total, color: CHART_COLORS.GREY }]}
              centerValue={compliance.pct === null ? "—" : `${compliance.pct}%`}
              centerLabel="Clean"
            />
          ) : (
            <EmptyState
              title="No published checklist entries this week"
              detail="Compliance is computed from published daily checklist entries."
            />
          )}
        </Card>
      </div>

      <div className="secbar">
        <h3>Checklist Bottlenecks</h3>
        <div className="line" />
      </div>
      <Card className="overflow-hidden">
        <BottleneckTable
          rows={bottlenecks.map((b) => ({
            responseId: b.responseId,
            categoryName: b.categoryName,
            itemName: b.itemName,
            issue: b.issue,
            severity: b.severity,
            entryDate: b.entryDate,
            evidence: b.evidence.map((e) => ({
              id: e.id,
              url: mediaUrl(e.storageKey),
              thumbUrl: mediaUrl(e.thumbnailKey),
              caption: e.caption,
            })),
          }))}
        />
      </Card>

      <div className="secbar">
        <h3>Updates — Task Status</h3>
        <div className="line" />
      </div>
      <Card className="overflow-hidden">
        {tasks.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="z-table" data-testid="task-table">
              <thead>
                <tr>
                  <th style={{ width: 44 }}>#</th>
                  <th>Task</th>
                  <th style={{ width: 120 }}>Status</th>
                  <th style={{ width: 130 }}>ETA / Completion</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t, i) => (
                  <tr key={t.id}>
                    <td className="font-mono text-xs text-muted">{String(i + 1).padStart(2, "0")}</td>
                    <td>{t.task}</td>
                    <td>
                      <TaskStatusBadge status={t.status} />
                    </td>
                    <td className="font-mono text-xs text-muted">{formatEta(t.etaDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 py-8 text-center text-[13px] text-muted">
            No {previewOn ? "approved or published" : "published"} tasks for this reporting week.
          </div>
        )}
      </Card>

      <div className="secbar">
        <h3>Progress Media</h3>
        <div className="line" />
      </div>
      <PhotoStrip
        photos={photos.map((p) => ({
          id: p.id,
          url: mediaUrl(p.storageKey),
          thumbUrl: mediaUrl(p.thumbnailKey),
          caption: p.caption,
          context: p.context,
        }))}
        emptyText={`No ${previewOn ? "approved or published" : "published"} progress photos for this week.`}
      />
    </div>
  );
}
