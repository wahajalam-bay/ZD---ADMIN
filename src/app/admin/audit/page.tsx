import type { Metadata } from "next";
import Link from "next/link";
import { listAuditLogs, listAllProperties } from "@/server/services/admin-service";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import { z } from "zod";

export const metadata: Metadata = { title: "Audit Log" };
export const dynamic = "force-dynamic";

const auditFilterSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  property: z.string().max(60).optional(),
  action: z.string().max(80).optional(),
});

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
      <div className="mb-1 text-[11.5px] font-semibold tracking-wider text-muted uppercase">
        Administration
      </div>
      <h2 className="mb-1 text-[22px] font-bold">Audit Log</h2>
      <p className="mb-4 text-[13px] text-muted">
        Immutable record of every significant action ({total} events). Filter by property with{" "}
        <code className="rounded bg-slate-100 px-1 font-mono text-xs">?property=code</code> or action
        with <code className="rounded bg-slate-100 px-1 font-mono text-xs">?action=name</code>.
      </p>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="z-table" data-testid="audit-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Action</th>
                <th>Actor</th>
                <th>Entity</th>
                <th>Property</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ log, actorName, propertyName }) => (
                <tr key={log.id}>
                  <td className="font-mono text-xs whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                  <td className="font-mono text-xs font-bold">{log.action}</td>
                  <td>{actorName ?? "system"}</td>
                  <td className="font-mono text-[11px] text-muted">
                    {log.entityType}
                    {log.entityId ? `#${log.entityId.slice(0, 8)}` : ""}
                  </td>
                  <td>{propertyName ?? "—"}</td>
                  <td className="max-w-[320px] truncate font-mono text-[11px] text-muted">
                    {log.afterData ? JSON.stringify(log.afterData) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {totalPages > 1 ? (
        <div className="mt-3 flex items-center justify-center gap-3 text-[13px]">
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
        </div>
      ) : null}
    </div>
  );
}
