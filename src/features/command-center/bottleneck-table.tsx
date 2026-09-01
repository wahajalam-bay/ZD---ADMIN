"use client";

import * as React from "react";
import { Camera } from "lucide-react";
import { SeverityBadge } from "@/components/ui/badge";
import { Lightbox } from "@/components/ui/lightbox";
import type { Severity } from "@/lib/compliance";

export interface BottleneckRowView {
  responseId: string;
  categoryName: string;
  itemName: string;
  issue: string;
  severity: Severity;
  entryDate: string;
  evidence: Array<{ id: string; url: string; thumbUrl: string; caption: string }>;
}

/**
 * Live bottleneck table. "Evidence" opens ONLY the photos attached to that
 * exact checklist response — never a generic gallery.
 */
export function BottleneckTable({ rows }: { rows: BottleneckRowView[] }) {
  const [open, setOpen] = React.useState<{ row: BottleneckRowView; index: number } | null>(null);

  if (rows.length === 0) {
    return (
      <div className="px-5 py-8 text-center text-[13px] text-muted">
        No bottlenecks found this week.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="z-table" data-testid="bottleneck-table">
          <thead>
            <tr>
              <th>Checklist</th>
              <th>Checklist Point</th>
              <th>Issue Found</th>
              <th style={{ width: 90 }}>Severity</th>
              <th style={{ width: 100 }}>Date</th>
              <th style={{ width: 110 }}>Evidence</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.responseId} data-testid={`bottleneck-${row.responseId}`}>
                <td className="font-semibold whitespace-nowrap">{row.categoryName}</td>
                <td className="whitespace-nowrap">{row.itemName}</td>
                <td className="min-w-[220px]">{row.issue}</td>
                <td>
                  <SeverityBadge severity={row.severity} />
                </td>
                <td className="font-mono text-xs text-muted">{row.entryDate}</td>
                <td>
                  {row.evidence.length > 0 ? (
                    <button
                      data-testid={`evidence-btn-${row.responseId}`}
                      onClick={() => setOpen({ row, index: 0 })}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-accent bg-accent-light px-2.5 py-1 text-[11.5px] font-bold text-accent-dark hover:bg-accent hover:text-white"
                    >
                      <Camera className="h-3.5 w-3.5" aria-hidden />
                      {row.evidence.length} photo{row.evidence.length > 1 ? "s" : ""}
                    </button>
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open ? (
        <Lightbox
          items={open.row.evidence.map((e) => ({
            src: e.url,
            title: e.caption || `${open.row.categoryName} — ${open.row.itemName}`,
            subtitle: `${open.row.categoryName} · ${open.row.itemName} · ${open.row.entryDate}`,
          }))}
          index={open.index}
          onClose={() => setOpen(null)}
          onNavigate={(i) => setOpen((o) => (o ? { ...o, index: i } : o))}
        />
      ) : null}
    </>
  );
}
