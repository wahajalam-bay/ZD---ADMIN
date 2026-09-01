import { auditTimeline } from "@/server/services/admin-service";
import { formatDateTime } from "@/lib/utils";
import { Card } from "@/components/ui/card";

/** Server component: immutable audit history for one record. */
export async function AuditTimeline({
  entityType,
  entityId,
}: {
  entityType: string;
  entityId: string;
}) {
  const rows = await auditTimeline(entityType, entityId);
  if (rows.length === 0) return null;
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-line px-5 py-3 text-[11px] font-bold tracking-wide text-muted uppercase">
        Audit history
      </div>
      <ul>
        {rows.map(({ log, actorName }) => (
          <li
            key={log.id}
            className="flex items-center justify-between gap-3 border-b border-line px-5 py-2 text-[12.5px] last:border-b-0"
          >
            <span>
              <b className="font-mono text-[11.5px]">{log.action}</b>
              {actorName ? <span className="text-muted"> · {actorName}</span> : null}
              {log.afterData && typeof log.afterData === "object" && "reason" in (log.afterData as object) ? (
                <span className="text-muted">
                  {" "}
                  — {(log.afterData as { reason?: string }).reason}
                </span>
              ) : null}
            </span>
            <span className="shrink-0 font-mono text-[11px] text-muted">
              {formatDateTime(log.createdAt)}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
