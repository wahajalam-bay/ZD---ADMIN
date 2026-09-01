import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { checklistEntries, properties } from "@/db/schema";
import { getEntryView } from "@/server/services/checklist-service";
import { PageHeader } from "@/components/shell/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { ReviewActionsBar } from "@/features/review/review-actions-bar";
import { AuditTimeline } from "@/features/review/audit-timeline";
import { ChecklistReviewBody } from "@/features/review/checklist-review";
import { formatDateTime } from "@/lib/utils";
import { mediaUrl } from "@/lib/media-url";
import { responseIsDefect } from "@/lib/compliance";

export const dynamic = "force-dynamic";

export default async function ChecklistReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entryRows = await db
    .select({ entry: checklistEntries, property: properties })
    .from(checklistEntries)
    .innerJoin(properties, eq(properties.id, checklistEntries.propertyId))
    .where(eq(checklistEntries.id, id))
    .limit(1);
  const row = entryRows[0];
  if (!row) notFound();

  const categoryRow = await db.query.checklistCategories.findFirst({
    where: (c, { eq: eqOp }) => eqOp(c.id, row.entry.categoryId),
  });
  if (!categoryRow) notFound();

  const view = await getEntryView(row.entry.propertyId, categoryRow.key, row.entry.entryDate);
  if (!view || !view.entry) notFound();

  const rows = view.items.map((item, i) => {
    const r = view.responses.get(item.id);
    return {
      id: item.id,
      index: i + 1,
      name: item.name,
      op: r?.op ?? false,
      cl: r?.cl ?? false,
      comment: r?.comment ?? "",
      severity: r?.severity ?? null,
      isIssue: r ? responseIsDefect(r) : false,
      photos: (r?.photos ?? []).map((p) => ({
        id: p.id,
        url: mediaUrl(p.storageKey),
        thumbUrl: mediaUrl(p.thumbnailKey),
        caption: p.caption || item.name,
      })),
    };
  });

  const issueCount = rows.filter((r) => r.isIssue).length;
  const evidenceCount = rows.reduce((a, r) => a + r.photos.length, 0);

  return (
    <div className="space-y-5" data-testid="review-checklist-detail">
      <PageHeader
        breadcrumb={[
          { label: "Review Queue", href: "/review" },
          { label: row.property.name },
          { label: view.category.name },
        ]}
        title={`${row.property.name} — ${view.category.name}`}
        meta={
          <>
            {row.entry.entryDate} · submitted {formatDateTime(row.entry.submittedAt)} · {issueCount}{" "}
            issue{issueCount === 1 ? "" : "s"} · {evidenceCount} evidence photo
            {evidenceCount === 1 ? "" : "s"}
          </>
        }
        controls={
          <div className="flex items-center gap-2">
            <StatusBadge status={row.entry.workflowStatus} />
            <Link
              href={`/entry/${row.property.code}/checklists/${view.category.key}?date=${row.entry.entryDate}`}
              className="rounded-input border border-line bg-panel px-3 py-1.5 text-[11.5px] font-bold hover:bg-panel2"
            >
              Open in entry form
            </Link>
          </div>
        }
      />

      <ReviewActionsBar kind="checklist" id={row.entry.id} status={row.entry.workflowStatus} />

      <div>
        <SectionHeader title="Submission" description="Issues are shown first — switch to all items for the full checklist." />
        <ChecklistReviewBody
          rows={rows}
          categoryName={view.category.name}
          entryDate={row.entry.entryDate}
          propertyName={row.property.name}
        />
      </div>

      {view.fieldDefs.length > 0 ? (
        <Card className="p-4">
          <div className="t-label mb-3 text-muted">Log fields</div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {view.fieldDefs.map((f) => (
              <div key={f.id}>
                <dt className="t-label text-muted">{f.label}</dt>
                <dd className="mt-0.5 font-mono text-[12.5px]">{view.values[f.id] || "—"}</dd>
              </div>
            ))}
          </dl>
        </Card>
      ) : null}

      <Card className="p-4">
        <div className="t-label mb-3 text-muted">Sign-off</div>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            ["Duty Electrician / Technician Sign", view.entry.signDutyTechnician],
            ["A.M Admin", view.entry.signAmAdmin],
            ["Manager Admin", view.entry.signManagerAdmin],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="t-label text-muted">{label}</dt>
              <dd className="mt-0.5 text-[12.5px]">{value || "—"}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <AuditTimeline entityType="checklist_entry" entityId={row.entry.id} />
    </div>
  );
}
