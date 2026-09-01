import Link from "next/link";
import { getPropertyByCode } from "@/server/permissions";
import { notFound } from "next/navigation";
import { entryHomeStats } from "@/server/services/entry-home-service";
import { Card, Kpi } from "@/components/ui/card";
import { StatusBadge, TrackingBadge } from "@/components/ui/badge";
import { weekRangeLabel } from "@/lib/week";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, string> = {
  "checklist.created": "Checklist created",
  "checklist.updated": "Checklist updated",
  "checklist.submitted": "Checklist submitted",
  "checklist.resubmitted": "Checklist resubmitted",
  "checklist.returned": "Checklist returned",
  "checklist.approved": "Checklist approved",
  "checklist.published": "Checklist published",
  "weekly.created": "Weekly report created",
  "weekly.updated": "Weekly report updated",
  "weekly.submitted": "Weekly report submitted",
  "weekly.resubmitted": "Weekly report resubmitted",
  "weekly.returned": "Weekly report returned",
  "weekly.approved": "Weekly report approved",
  "weekly.published": "Weekly report published",
  "photo.evidence.added": "Evidence photo added",
  "photo.evidence.deleted": "Evidence photo deleted",
  "photo.weekly.added": "Progress photo added",
  "photo.weekly.deleted": "Progress photo deleted",
  "publication.week": "Week published",
};

export default async function EntryOverviewPage({
  params,
}: {
  params: Promise<{ propertyCode: string }>;
}) {
  const { propertyCode } = await params;
  const property = await getPropertyByCode(propertyCode);
  if (!property) notFound();
  const stats = await entryHomeStats(property.id);

  return (
    <div data-testid="entry-overview">
      <p className="mb-4 text-[13px] text-muted">
        Reporting week <b className="font-mono">{weekRangeLabel(stats.weekStart)}</b> · today{" "}
        <b className="font-mono">{stats.today}</b>
      </p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Filed today"
          value={`${stats.filedToday}/${stats.categoriesTotal}`}
          tone={stats.filedToday === stats.categoriesTotal ? "ok" : "ink"}
        />
        <Kpi label="Drafts today" value={stats.draftToday} tone="warn" />
        <Kpi
          label="Pending corrections"
          value={stats.returnedThisWeek}
          tone={stats.returnedThisWeek > 0 ? "bad" : "ink"}
        />
        <Card className="px-4 py-3.5">
          <div className="mb-1 text-[10.5px] font-bold tracking-wider text-muted uppercase">
            Weekly report
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={stats.weeklyReport?.workflowStatus ?? null} />
            {stats.weeklyReport ? (
              <TrackingBadge status={stats.weeklyReport.trackingStatus} />
            ) : null}
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-3.5 sm:grid-cols-2">
        <Link
          href={`/entry/${property.code}/checklists`}
          className="rounded-card border border-line bg-panel px-5 py-4 shadow-card transition hover:-translate-y-0.5 hover:border-accent"
        >
          <h3 className="text-[15px] font-bold">Daily Checklists →</h3>
          <p className="mt-1 text-xs text-muted">
            {stats.categoriesTotal} categories · fill in OP/CL per item, flag defects, attach evidence
            photos.
          </p>
        </Link>
        <Link
          href={`/entry/${property.code}/weekly`}
          className="rounded-card border border-line bg-panel px-5 py-4 shadow-card transition hover:-translate-y-0.5 hover:border-accent"
        >
          <h3 className="text-[15px] font-bold">Weekly Report →</h3>
          <p className="mt-1 text-xs text-muted">
            Tracking status, management summary, task updates and progress photos for the week.
          </p>
        </Link>
      </div>

      <div className="secbar">
        <h3>Recent activity</h3>
        <div className="line" />
      </div>
      <Card className="overflow-hidden">
        {stats.recentActivity.length === 0 ? (
          <div className="px-5 py-7 text-center text-[13px] text-muted">No activity yet.</div>
        ) : (
          <ul>
            {stats.recentActivity.map(({ log, actorName }) => (
              <li
                key={log.id}
                className="flex items-center justify-between gap-3 border-b border-line px-5 py-2.5 text-[13px] last:border-b-0"
              >
                <span>
                  <b>{ACTION_LABELS[log.action] ?? log.action}</b>
                  {actorName ? <span className="text-muted"> · {actorName}</span> : null}
                </span>
                <span className="shrink-0 font-mono text-[11px] text-muted">
                  {formatDateTime(log.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
