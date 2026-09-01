import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { properties, weeklyReports } from "@/db/schema";
import { getWeeklyReportView } from "@/server/services/weekly-report-service";
import { StatusBadge, TaskStatusBadge, TrackingBadge } from "@/components/ui/status-badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ReviewActionsBar } from "@/features/review/review-actions-bar";
import { AuditTimeline } from "@/features/review/audit-timeline";
import { EvidenceThumbs } from "@/features/review/evidence-thumbs";
import { formatDateTime, formatEta } from "@/lib/utils";
import { weekRangeLabel } from "@/lib/week";
import { mediaUrl } from "@/lib/media-url";

export const dynamic = "force-dynamic";

export default async function WeeklyReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await db
    .select({ report: weeklyReports, property: properties })
    .from(weeklyReports)
    .innerJoin(properties, eq(properties.id, weeklyReports.propertyId))
    .where(eq(weeklyReports.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) notFound();

  const { report, tasks, media } = await getWeeklyReportView(row.report.propertyId, row.report.weekStart);
  if (!report) notFound();

  return (
    <div className="space-y-5" data-testid="review-weekly-detail">
      <PageHeader
        breadcrumb={[
          { label: "Review Queue", href: "/review" },
          { label: row.property.name },
          { label: "Weekly Report" },
        ]}
        title={`${row.property.name} — Weekly Report`}
        meta={
          <>
            {weekRangeLabel(report.weekStart)} · submitted {formatDateTime(report.submittedAt)} ·{" "}
            {tasks.length} task{tasks.length === 1 ? "" : "s"} · {media.length} photo
            {media.length === 1 ? "" : "s"}
          </>
        }
        controls={
          <div className="flex items-center gap-2">
            <TrackingBadge status={report.trackingStatus} />
            <StatusBadge status={report.workflowStatus} />
            <Link
              href={`/entry/${row.property.code}/weekly?week=${report.weekStart}`}
              className="rounded-input border border-line bg-panel px-3 py-1.5 text-[11.5px] font-bold hover:bg-panel2"
            >
              Open in entry form
            </Link>
          </div>
        }
      />

      <ReviewActionsBar kind="weekly" id={report.id} status={report.workflowStatus} />

      <Card className="p-5">
        <div className="mb-1 t-label text-muted">
          Management summary
        </div>
        <p className="text-[14px]">{report.summary || "—"}</p>
        {report.notes ? (
          <>
            <div className="mt-4 mb-1 t-label text-muted">Notes</div>
            <p className="text-[13px] whitespace-pre-wrap text-muted">{report.notes}</p>
          </>
        ) : null}
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-line px-5 py-3 t-label text-muted">
          Tasks ({tasks.length})
        </div>
        {tasks.length === 0 ? (
          <EmptyState compact title="No tasks were recorded in this weekly report" />
        ) : (
          <table className="z-table">
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
        )}
      </Card>

      <Card className="p-5">
        <div className="mb-3 t-label text-muted">
          Progress photos ({media.length})
        </div>
        {media.length === 0 ? (
          <p className="text-[13px] text-muted">No photos attached.</p>
        ) : (
          <EvidenceThumbs
            photos={media.map((m) => ({
              id: m.id,
              url: mediaUrl(m.storageKey),
              thumbUrl: mediaUrl(m.thumbnailKey),
              caption: m.caption || "Progress photo",
            }))}
            title={`${row.property.name} · week of ${report.weekStart}`}
          />
        )}
      </Card>

      <AuditTimeline entityType="weekly_report" entityId={report.id} />
    </div>
  );
}
