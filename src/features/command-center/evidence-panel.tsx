"use client";

import * as React from "react";
import { CalendarDays, Camera, ClipboardCheck, MessageSquare } from "lucide-react";
import { AnalyticsPanel } from "@/components/ui/analytics-panel";
import { SeverityBadge, StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Lightbox } from "@/components/ui/lightbox";
import { formatDateTime } from "@/lib/utils";
import type { Severity } from "@/lib/compliance";
import type { WorkflowStatus } from "@/lib/roles";

export interface EvidencePhoto {
  id: string;
  url: string;
  thumbUrl: string;
  caption: string;
}

export interface EvidenceIssue {
  responseId: string;
  categoryName: string;
  itemName: string;
  issue: string;
  severity: Severity;
  entryDate: string;
  workflowStatus?: WorkflowStatus;
  evidence: EvidencePhoto[];
  /** Optional workflow provenance for the timeline. */
  submittedBy?: string | null;
  submittedAt?: string | null;
  reviewedBy?: string | null;
  approvedAt?: string | null;
  publishedAt?: string | null;
}

/**
 * Slide-in evidence/analytics panel for one checklist point. Shows ONLY the
 * photographs attached to that exact checklist response — the non-negotiable
 * evidence relationship — plus issue context and the workflow timeline.
 */
export function EvidencePanel({
  issue,
  propertyName,
  onClose,
}: {
  issue: EvidenceIssue | null;
  propertyName?: string;
  onClose: () => void;
}) {
  const [lightboxState, setLightbox] = React.useState<number | null>(null);
  // Derived, not synced: a closed/changed issue implies no open lightbox.
  const lightbox = issue ? lightboxState : null;

  if (!issue) return null;

  const timeline = [
    { label: "Submitted", at: issue.submittedAt, by: issue.submittedBy },
    { label: "Approved", at: issue.approvedAt, by: issue.reviewedBy },
    { label: "Published", at: issue.publishedAt, by: null },
  ].filter((t) => t.at);

  return (
    <>
      <AnalyticsPanel
        open
        onClose={onClose}
        title={issue.itemName}
        subtitle={issue.categoryName}
        breadcrumb={[propertyName ?? "Property", issue.categoryName, issue.itemName].filter(Boolean)}
      >
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={issue.severity} />
          {issue.workflowStatus ? <StatusBadge status={issue.workflowStatus} size="sm" /> : null}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel2 px-2.5 py-1 text-[11px] font-semibold text-muted">
            <CalendarDays className="h-3 w-3" aria-hidden />
            {issue.entryDate}
          </span>
        </div>

        <section className="mt-4">
          <h3 className="t-label mb-1.5 flex items-center gap-1.5 text-muted">
            <MessageSquare className="h-3 w-3" aria-hidden /> Issue found
          </h3>
          <p className="rounded-tile border border-bad/25 bg-bad-bg px-3 py-2.5 text-[12.5px] leading-relaxed text-bad">
            {issue.issue}
          </p>
        </section>

        <section className="mt-5">
          <h3 className="t-label mb-2 flex items-center gap-1.5 text-muted">
            <Camera className="h-3 w-3" aria-hidden /> Evidence ({issue.evidence.length})
          </h3>
          {issue.evidence.length === 0 ? (
            <EmptyState
              compact
              icon="camera"
              title="No photograph attached to this checklist point"
              detail="Site teams can attach evidence when recording or correcting the issue."
            />
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {issue.evidence.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setLightbox(i)}
                  data-testid={`panel-evidence-${p.id}`}
                  className="overflow-hidden rounded-tile border border-line text-start transition-shadow hover:shadow-card-2"
                >
                  { }
                  <img src={p.thumbUrl} alt={p.caption || issue.itemName} className="h-[104px] w-full object-cover" />
                  {p.caption ? (
                    <span className="block truncate px-2 py-1.5 text-[10.5px] text-muted">{p.caption}</span>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </section>

        {timeline.length > 0 ? (
          <section className="mt-5">
            <h3 className="t-label mb-2 flex items-center gap-1.5 text-muted">
              <ClipboardCheck className="h-3 w-3" aria-hidden /> Timeline
            </h3>
            <ol className="relative ms-1.5 border-s border-line ps-4">
              {timeline.map((t) => (
                <li key={t.label} className="relative pb-3 last:pb-0">
                  <span
                    aria-hidden
                    className="absolute -start-[21px] top-1 h-2 w-2 rounded-full bg-accent ring-2 ring-[var(--surface)]"
                  />
                  <div className="text-[12px] font-semibold text-ink">{t.label}</div>
                  <div className="text-[11px] text-muted">
                    {formatDateTime(t.at ?? null)}
                    {t.by ? ` · ${t.by}` : ""}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </AnalyticsPanel>

      {lightbox !== null ? (
        <Lightbox
          items={issue.evidence.map((p) => ({
            src: p.url,
            title: p.caption || issue.itemName,
            subtitle: `${propertyName ? `${propertyName} · ` : ""}${issue.categoryName} · ${issue.entryDate}`,
          }))}
          index={lightbox}
          onClose={() => setLightbox(null)}
          onNavigate={setLightbox}
        />
      ) : null}
    </>
  );
}
