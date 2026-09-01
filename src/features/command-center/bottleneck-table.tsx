"use client";

import * as React from "react";
import { Camera } from "lucide-react";
import { SeverityBadge, StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { EvidencePanel, type EvidenceIssue } from "./evidence-panel";
import { cn } from "@/lib/utils";

export interface BottleneckRowView extends EvidenceIssue {
  ageDays: number;
}

/**
 * Checklist bottlenecks (audit R5). Columns: Severity · Checklist · Checklist
 * Point · Issue Found · Date/Age · Evidence · Status. The obsolete "Slide"
 * column is gone; Evidence opens the slide-in panel with ONLY the photographs
 * attached to that exact checklist response.
 */
export function BottleneckTable({
  rows,
  propertyName,
}: {
  rows: BottleneckRowView[];
  propertyName: string;
}) {
  const [open, setOpen] = React.useState<BottleneckRowView | null>(null);

  if (rows.length === 0) {
    return (
      <EmptyState
        compact
        title="No checklist bottlenecks this week"
        detail={`Every published checklist for ${propertyName} came back clean for this reporting week.`}
      />
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="z-table z-table--exec" data-testid="bottleneck-table">
          <thead>
            <tr>
              <th style={{ width: 96 }}>Severity</th>
              <th style={{ width: 160 }}>Checklist</th>
              <th style={{ width: 180 }}>Checklist Point</th>
              <th>Issue Found</th>
              <th style={{ width: 128 }}>Date / Age</th>
              <th style={{ width: 108 }}>Evidence</th>
              <th style={{ width: 112 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.responseId} data-testid={`bottleneck-${row.responseId}`}>
                <td>
                  <SeverityBadge severity={row.severity} size="sm" />
                </td>
                <td className="font-semibold whitespace-nowrap">{row.categoryName}</td>
                <td className="whitespace-nowrap">{row.itemName}</td>
                <td className="min-w-[220px]">{row.issue}</td>
                <td className="whitespace-nowrap">
                  <span className="font-mono text-[11.5px] text-muted">{row.entryDate}</span>
                  <span
                    className={cn(
                      "ms-1.5 font-mono text-[11px]",
                      row.ageDays >= 3 ? "font-bold text-bad" : "text-muted",
                    )}
                  >
                    {row.ageDays === 0 ? "today" : `${row.ageDays}d`}
                  </span>
                </td>
                <td>
                  {row.evidence.length > 0 ? (
                    <button
                      type="button"
                      data-testid={`evidence-btn-${row.responseId}`}
                      onClick={() => setOpen(row)}
                      className="inline-flex items-center gap-1.5 rounded-input border border-accent/40 bg-accent-light px-2 py-1 text-[11px] font-bold text-accent-dark transition-colors hover:bg-accent hover:text-white"
                    >
                      <Camera className="h-3 w-3" aria-hidden />
                      {row.evidence.length} photo{row.evidence.length > 1 ? "s" : ""}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setOpen(row)}
                      className="text-[11.5px] font-semibold text-muted underline-offset-2 hover:underline"
                    >
                      No evidence
                    </button>
                  )}
                </td>
                <td>
                  {row.workflowStatus ? <StatusBadge status={row.workflowStatus} size="sm" /> : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <EvidencePanel issue={open} propertyName={propertyName} onClose={() => setOpen(null)} />
    </>
  );
}
