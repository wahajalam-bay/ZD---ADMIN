import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { listAuditLogs, listAllProperties } from "@/server/services/admin-service";
import { PageHeader } from "@/components/shell/page-header";
import { AuditLogTable } from "@/features/admin/audit-log";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Audit Log" };
export const dynamic = "force-dynamic";

const auditFilterSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  property: z.string().max(60).optional(),
  action: z.string().max(80).optional(),
});

/** Pulls the most identifying value out of an audit payload for the row line. */
function auditSubject(after: unknown, metadata: unknown): string | null {
  for (const source of [after, metadata]) {
    if (!source || typeof source !== "object") continue;
    const o = source as Record<string, unknown>;
    for (const key of ["email", "title", "code", "name", "reason", "filename", "domain", "weekStart"]) {
      const v = o[key];
      if (typeof v === "string" && v.trim()) return v;
    }
  }
  return null;
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const raw = await searchParams;
  const parsed = auditFilterSchema.safeParse(raw);
  const filters = parsed.success ? parsed.data : auditFilterSchema.parse({});

  const propertiesList = await listAllProperties();
  const selectedProperty = propertiesList.find((p) => p.code === filters.property);
  const { rows, total, pageSize } = await listAuditLogs({
    page: filters.page,
    propertyId: selectedProperty?.id,
    action: filters.action,
  });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function pageHref(page: number) {
    const params = new URLSearchParams();
    if (page > 1) params.set("page", String(page));
    if (filters.property) params.set("property", filters.property);
    if (filters.action) params.set("action", filters.action);
    const qs = params.toString();
    return `/admin/audit${qs ? `?${qs}` : ""}`;
  }

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Audit Log"
        meta={
          <>
            {total} recorded events · immutable history of every submission, approval, publication and
            administrative change
          </>
        }
      />

      <AuditLogTable
        rows={rows.map(({ log, actorName, propertyName }) => ({
          id: log.id,
          action: log.action,
          actorName,
          propertyName,
          entityType: log.entityType,
          entityId: log.entityId,
          createdAt: formatDateTime(log.createdAt),
          subject: auditSubject(log.afterData, log.metadata),
          detail:
            log.afterData || log.metadata
              ? JSON.stringify({ after: log.afterData, meta: log.metadata }, null, 2)
              : null,
        }))}
      />

      {totalPages > 1 ? (
        <nav className="mt-4 flex items-center justify-center gap-4 text-[12.5px]" aria-label="Audit pagination">
          {filters.page > 1 ? (
            <Link href={pageHref(filters.page - 1)} className="font-bold text-accent-dark hover:underline">
              ← Newer
            </Link>
          ) : null}
          <span className="text-muted">
            Page {filters.page} of {totalPages}
          </span>
          {filters.page < totalPages ? (
            <Link href={pageHref(filters.page + 1)} className="font-bold text-accent-dark hover:underline">
              Older →
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
