"use client";

import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

export interface AuditRow {
  id: string;
  action: string;
  actorName: string | null;
  propertyName: string | null;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  /** Human subject of the event, e.g. the affected email or property code. */
  subject: string | null;
  detail: string | null;
}

/** Human phrasing for each audited action (audit A3 — no raw JSON up front). */
const PHRASES: Record<string, { verb: string; tone: "green" | "orange" | "red" | "blue" | "neutral" }> = {
  "checklist.created": { verb: "Created a checklist", tone: "neutral" },
  "checklist.updated": { verb: "Updated a checklist", tone: "neutral" },
  "checklist.submitted": { verb: "Submitted a checklist", tone: "blue" },
  "checklist.resubmitted": { verb: "Resubmitted a checklist", tone: "blue" },
  "checklist.returned": { verb: "Returned a checklist", tone: "red" },
  "checklist.approved": { verb: "Approved a checklist", tone: "green" },
  "checklist.published": { verb: "Published a checklist", tone: "green" },
  "weekly.created": { verb: "Started a weekly report", tone: "neutral" },
  "weekly.updated": { verb: "Updated a weekly report", tone: "neutral" },
  "weekly.submitted": { verb: "Submitted a weekly report", tone: "blue" },
  "weekly.resubmitted": { verb: "Resubmitted a weekly report", tone: "blue" },
  "weekly.returned": { verb: "Returned a weekly report", tone: "red" },
  "weekly.approved": { verb: "Approved a weekly report", tone: "green" },
  "weekly.published": { verb: "Published a weekly report", tone: "green" },
  "publication.week": { verb: "Published a reporting week", tone: "green" },
  "photo.evidence.added": { verb: "Added evidence photo", tone: "neutral" },
  "photo.evidence.deleted": { verb: "Deleted evidence photo", tone: "orange" },
  "photo.weekly.added": { verb: "Added progress photo", tone: "neutral" },
  "photo.weekly.deleted": { verb: "Deleted progress photo", tone: "orange" },
  "photo.demo.purged": { verb: "Purged demo media", tone: "orange" },
  "user.created": { verb: "Created a user", tone: "blue" },
  "user.disabled": { verb: "Disabled a user", tone: "red" },
  "user.enabled": { verb: "Reactivated a user", tone: "green" },
  "user.role_changed": { verb: "Changed a user's role", tone: "orange" },
  "user.password_reset": { verb: "Reset a user password", tone: "orange" },
  "property.created": { verb: "Created a property", tone: "blue" },
  "property.updated": { verb: "Updated property master data", tone: "neutral" },
  "property.activated": { verb: "Activated a property", tone: "green" },
  "property.deactivated": { verb: "Deactivated a property", tone: "orange" },
  "propone.import": { verb: "Imported PropOne records", tone: "blue" },
  "propone.sync": { verb: "Synced PropOne from Redshift", tone: "blue" },
  "propone.redshift_connection_test": { verb: "Tested the Redshift connection", tone: "neutral" },
  "propone.widget_config_changed": { verb: "Changed PropOne widgets", tone: "neutral" },
};

export function AuditLogTable({ rows }: { rows: AuditRow[] }) {
  const [expanded, setExpanded] = React.useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No audit events match this filter"
        detail="Every submission, approval, publication and administrative change is recorded here."
      />
    );
  }

  return (
    <Card className="overflow-hidden" data-testid="audit-table">
      <ul className="divide-y divide-line">
        {rows.map((r) => {
          const phrase = PHRASES[r.action] ?? { verb: r.action, tone: "neutral" as const };
          const open = expanded === r.id;
          return (
            <li key={r.id}>
              <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <span className="w-[104px] shrink-0 font-mono text-[11px] text-muted">
                  {r.createdAt}
                </span>
                <span className="min-w-[140px] shrink-0 text-[12.5px] font-bold text-ink">
                  {r.actorName ?? "System"}
                </span>
                <Badge tone={phrase.tone} size="sm">
                  {phrase.verb}
                </Badge>
                <span className="min-w-0 flex-1 truncate text-[12px]">
                  {r.subject ? <span className="font-medium text-ink">{r.subject}</span> : null}
                  {r.subject && r.propertyName ? <span className="text-muted"> · </span> : null}
                  <span className="text-muted">
                    {[r.propertyName, r.entityType.replace(/_/g, " ")].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {r.detail ? (
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setExpanded(open ? null : r.id)}
                    className="inline-flex items-center gap-1 text-[11.5px] font-bold text-accent-dark hover:underline"
                  >
                    {open ? (
                      <ChevronDown className="h-3 w-3" aria-hidden />
                    ) : (
                      <ChevronRight className="h-3 w-3" aria-hidden />
                    )}
                    Details
                  </button>
                ) : null}
              </div>
              {open && r.detail ? (
                <pre
                  className={cn(
                    "anim-fade overflow-x-auto border-t border-line bg-panel2 px-4 py-2.5",
                    "font-mono text-[11px] leading-relaxed text-muted",
                  )}
                >
                  {r.detail}
                </pre>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
