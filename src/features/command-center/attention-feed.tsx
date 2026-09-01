"use client";

import * as React from "react";
import { AlertTriangle, Camera, ChevronRight } from "lucide-react";
import { SeverityBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { EvidencePanel, type EvidenceIssue } from "./evidence-panel";
import { cn } from "@/lib/utils";

export interface AttentionRow extends EvidenceIssue {
  propertyCode: string;
  propertyName: string;
  ageDays: number;
}

/**
 * Attention Required (management exception surface): the live operational
 * issues that matter, severity-then-age ordered. Clicking a row opens the
 * slide-in evidence panel (§4) rather than navigating away.
 */
export function AttentionFeed({
  rows,
  emptyTitle,
  emptyDetail,
  showProperty = true,
  limit,
}: {
  rows: AttentionRow[];
  emptyTitle: string;
  emptyDetail?: string;
  showProperty?: boolean;
  limit?: number;
}) {
  const [openIssue, setOpenIssue] = React.useState<AttentionRow | null>(null);
  const [showAll, setShowAll] = React.useState(false);
  const visible = showAll || !limit ? rows : rows.slice(0, limit);

  if (rows.length === 0) {
    return <EmptyState icon="checkCircle" title={emptyTitle} detail={emptyDetail} compact />;
  }

  return (
    <>
      <div className="overflow-hidden rounded-card border border-line bg-panel shadow-card" data-testid="attention-feed">
        <ul className="divide-y divide-line">
          {visible.map((row) => (
            <li key={row.responseId}>
              <button
                type="button"
                onClick={() => setOpenIssue(row)}
                data-testid={`attention-${row.responseId}`}
                className="flex w-full items-center gap-3 px-3.5 py-2.5 text-start transition-colors hover:bg-panel2"
              >
                <SeverityBadge severity={row.severity} size="sm" />
                {showProperty ? (
                  <span className="w-[86px] shrink-0 truncate text-[12.5px] font-bold text-ink">
                    {row.propertyName}
                  </span>
                ) : null}
                <span className="hidden w-[150px] shrink-0 truncate text-[12px] text-muted sm:block">
                  {row.categoryName}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-semibold text-ink">
                    {row.itemName}
                  </span>
                  <span className="block truncate text-[11.5px] text-muted">{row.issue}</span>
                </span>
                <span
                  className={cn(
                    "hidden shrink-0 font-mono text-[11px] md:block",
                    row.ageDays >= 3 ? "font-bold text-bad" : "text-muted",
                  )}
                >
                  {row.ageDays === 0 ? "today" : `open ${row.ageDays}d`}
                </span>
                {row.evidence.length > 0 ? (
                  <span className="hidden shrink-0 items-center gap-1 rounded-full border border-line bg-panel2 px-2 py-0.5 text-[10.5px] font-bold text-accent-dark sm:inline-flex">
                    <Camera className="h-3 w-3" aria-hidden />
                    {row.evidence.length}
                  </span>
                ) : null}
                <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        {limit && rows.length > limit ? (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="w-full border-t border-line bg-panel2 py-2 text-[11.5px] font-bold text-accent-dark hover:bg-accent-light"
          >
            {showAll ? "Show fewer" : `Show all ${rows.length} issues`}
          </button>
        ) : null}
      </div>

      <EvidencePanel
        issue={openIssue}
        propertyName={openIssue?.propertyName}
        onClose={() => setOpenIssue(null)}
      />
    </>
  );
}

export { AlertTriangle };
