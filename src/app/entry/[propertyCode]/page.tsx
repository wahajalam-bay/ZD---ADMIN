import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  RotateCcw,
  } from "lucide-react";
import { getPropertyByCode } from "@/server/permissions";
import { entryHomeStats } from "@/server/services/entry-home-service";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { KpiCard, KpiStrip } from "@/components/ui/kpi-card";
import { StatusBadge, TrackingBadge } from "@/components/ui/status-badge";
import { SectionHeader } from "@/components/ui/section-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon, type IconName } from "@/components/ui/icon";
import { weekRangeLabel } from "@/lib/week";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, string> = {
  "checklist.created": "Checklist created",
  "checklist.updated": "Checklist updated",
  "checklist.submitted": "Checklist submitted",
  "checklist.resubmitted": "Checklist resubmitted",
  "checklist.returned": "Checklist returned for correction",
  "checklist.approved": "Checklist approved",
  "checklist.published": "Checklist published",
  "weekly.created": "Weekly report started",
  "weekly.updated": "Weekly report updated",
  "weekly.submitted": "Weekly report submitted",
  "weekly.resubmitted": "Weekly report resubmitted",
  "weekly.returned": "Weekly report returned",
  "weekly.approved": "Weekly report approved",
  "weekly.published": "Weekly report published",
  "photo.evidence.added": "Evidence photo added",
  "photo.evidence.deleted": "Evidence photo removed",
  "photo.weekly.added": "Progress photo added",
  "photo.weekly.deleted": "Progress photo removed",
  "publication.week": "Reporting week published",
};

/** "My Site" operations view for the site team (audit E2). */
export default async function EntryOverviewPage({
  params,
}: {
  params: Promise<{ propertyCode: string }>;
}) {
  const { propertyCode } = await params;
  const property = await getPropertyByCode(propertyCode);
  if (!property) notFound();
  const stats = await entryHomeStats(property.id);
  const pct =
    stats.categoriesTotal > 0 ? Math.round((stats.filedToday / stats.categoriesTotal) * 100) : 0;

  return (
    <div data-testid="entry-overview">
      <PageHeader
        eyebrow="Site Operations"
        title={property.name}
        meta={
          <>
            Today {stats.today} · reporting week {weekRangeLabel(stats.weekStart)}
          </>
        }
        controls={
          <div className="flex items-center gap-2">
            <StatusBadge status={stats.weeklyReport?.workflowStatus ?? null} />
            {stats.weeklyReport ? (
              <TrackingBadge status={stats.weeklyReport.trackingStatus} />
            ) : null}
          </div>
        }
      />

      {stats.returnedThisWeek > 0 ? (
        <Link
          href={`/entry/${property.code}/checklists?filter=RETURNED`}
          className="mb-5 flex items-center gap-3 rounded-card border border-bad/40 bg-bad-bg px-4 py-3 text-[12.5px] text-bad transition-colors hover:border-bad"
          data-testid="returned-banner"
        >
          <RotateCcw className="h-4 w-4 shrink-0" aria-hidden />
          <span className="flex-1">
            <b>
              {stats.returnedThisWeek} submission{stats.returnedThisWeek > 1 ? "s were" : " was"}{" "}
              returned for correction.
            </b>{" "}
            Amend and resubmit so the week can be published.
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 font-bold">
            Fix now <ArrowRight className="h-3 w-3" aria-hidden />
          </span>
        </Link>
      ) : null}

      <KpiStrip cols={4} className="mb-6">
        <KpiCard
          label="Today's checklists"
          value={`${stats.filedToday}/${stats.categoriesTotal}`}
          icon="clipboard"
          tone={stats.filedToday === stats.categoriesTotal ? "green" : "neutral"}
          progress={pct}
        />
        <KpiCard label="Drafts" value={stats.draftToday} icon="draft" tone="orange" />
        <KpiCard
          label="Returned"
          value={stats.returnedThisWeek}
          icon="returned"
          tone={stats.returnedThisWeek > 0 ? "red" : "neutral"}
        />
        <KpiCard
          label="Weekly report"
          value={stats.weeklyReport ? stats.weeklyReport.workflowStatus.toLowerCase() : "not started"}
          icon="scroll"
          tone={stats.weeklyReport?.workflowStatus === "PUBLISHED" ? "green" : "blue"}
        />
      </KpiStrip>

      <div className="grid gap-4 sm:grid-cols-2">
        <PrimaryAction
          href={`/entry/${property.code}/checklists`}
          icon="clipboard"
          title="Daily Checklists"
          detail={`${stats.categoriesTotal} categories · mark OP/CL, flag issues, attach evidence.`}
        />
        <PrimaryAction
          href={`/entry/${property.code}/weekly`}
          icon="calendar"
          title="Weekly Report"
          detail="Tracking status, management summary, task updates and progress photos."
        />
      </div>

      <SectionHeader className="mt-8" title="Recent activity" icon="activity" />
      <Card className="overflow-hidden">
        {stats.recentActivity.length === 0 ? (
          <EmptyState
            compact
            title="No activity recorded for this site yet"
            detail="Saving a draft, submitting a checklist or uploading a photo will appear here."
          />
        ) : (
          <ul className="divide-y divide-line">
            {stats.recentActivity.map(({ log, actorName }) => (
              <li key={log.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[12.5px]">
                <span className="min-w-0">
                  <b className="text-ink">{ACTION_LABELS[log.action] ?? log.action}</b>
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

function PrimaryAction({
  href,
  icon,
  title,
  detail,
}: {
  href: string;
  icon: IconName;
  title: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-card border border-line bg-panel p-4 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:border-accent hover:shadow-card-2"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-tile bg-accent-light text-accent-dark">
        <Icon name={icon} className="h-4.5 w-4.5" />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-[14.5px] font-bold text-ink group-hover:text-accent-dark">
          {title} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </span>
        <span className="mt-0.5 block text-[11.5px] leading-relaxed text-muted">{detail}</span>
      </span>
    </Link>
  );
}
