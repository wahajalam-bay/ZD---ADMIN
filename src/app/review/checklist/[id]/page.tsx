import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { checklistEntries, properties } from "@/db/schema";
import { getEntryView } from "@/server/services/checklist-service";
import { StatusBadge, SeverityBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ReviewActionsBar } from "@/features/review/review-actions-bar";
import { AuditTimeline } from "@/features/review/audit-timeline";
import { EvidenceThumbs } from "@/features/review/evidence-thumbs";
import { formatDateTime } from "@/lib/utils";
import { mediaUrl } from "@/lib/media-url";
import { responseIsDefect } from "@/lib/compliance";

export const dynamic = "force-dynamic";

export default async function ChecklistReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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

  const issueRows = view.items.filter((item) => {
    const r = view.responses.get(item.id);
    return r && responseIsDefect(r);
  });

  return (
    <div className="space-y-4" data-testid="review-checklist-detail">
      <div>
        <Link href="/review" className="text-xs font-semibold text-accent-dark hover:underline">
          ← Review queue
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[20px] font-bold">
              {row.property.name} — {view.category.name}
            </h2>
            <p className="mt-0.5 font-mono text-xs text-muted">
              {row.entry.entryDate} · submitted {formatDateTime(row.entry.submittedAt)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={row.entry.workflowStatus} />
            <Link
              href={`/entry/${row.property.code}/checklists/${view.category.key}?date=${row.entry.entryDate}`}
              className="rounded-lg border border-line bg-panel px-3 py-1.5 text-xs font-bold hover:bg-slate-50"
            >
              Open in entry form
            </Link>
          </div>
        </div>
      </div>

      {view.fieldDefs.length > 0 ? (
        <Card className="p-5">
          <div className="mb-3 text-[11px] font-bold tracking-wide text-muted uppercase">Log fields</div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {view.fieldDefs.map((f) => (
              <div key={f.id}>
                <dt className="text-[10.5px] font-bold tracking-wide text-muted uppercase">{f.label}</dt>
                <dd className="mt-0.5 font-mono text-[13px]">{view.values[f.id] || "—"}</dd>
              </div>
            ))}
          </dl>
        </Card>
      ) : null}

      {view.items.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="border-b border-line px-5 py-3 text-[11px] font-bold tracking-wide text-muted uppercase">
            Checklist responses ({issueRows.length} issue{issueRows.length === 1 ? "" : "s"})
          </div>
          <div className="overflow-x-auto">
            <table className="z-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>#</th>
                  <th>Item</th>
                  <th style={{ width: 46, textAlign: "center" }}>OP</th>
                  <th style={{ width: 46, textAlign: "center" }}>CL</th>
                  <th>Defect / Comment</th>
                  <th style={{ width: 90 }}>Severity</th>
                  <th style={{ width: 130 }}>Evidence</th>
                </tr>
              </thead>
              <tbody>
                {view.items.map((item, i) => {
                  const r = view.responses.get(item.id);
                  return (
                    <tr key={item.id}>
                      <td className="font-mono text-xs text-muted">{i + 1}</td>
                      <td className="font-semibold">{item.name}</td>
                      <td className="text-center">{r?.op ? "✓" : "—"}</td>
                      <td className="text-center">{r?.cl ? "✓" : "—"}</td>
                      <td className={r?.comment ? "text-bad" : "text-muted"}>{r?.comment || "—"}</td>
                      <td>
                        {r && responseIsDefect(r) ? (
                          <SeverityBadge severity={r.severity ?? "LOW"} />
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>
                      <td>
                        {r && r.photos.length > 0 ? (
                          <EvidenceThumbs
                            photos={r.photos.map((p) => ({
                              id: p.id,
                              url: mediaUrl(p.storageKey),
                              thumbUrl: mediaUrl(p.thumbnailKey),
                              caption: p.caption || item.name,
                            }))}
                            title={`${view.category.name} · ${item.name} · ${row.entry.entryDate}`}
                          />
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <Card className="p-5">
        <div className="mb-3 text-[11px] font-bold tracking-wide text-muted uppercase">Sign-off</div>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            ["Duty Electrician / Technician Sign", view.entry.signDutyTechnician],
            ["A.M Admin", view.entry.signAmAdmin],
            ["Manager Admin", view.entry.signManagerAdmin],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-[10.5px] font-bold tracking-wide text-muted uppercase">{label}</dt>
              <dd className="mt-0.5 text-[13px]">{value || "—"}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <ReviewActionsBar kind="checklist" id={row.entry.id} status={row.entry.workflowStatus} />
      <AuditTimeline entityType="checklist_entry" entityId={row.entry.id} />
    </div>
  );
}
