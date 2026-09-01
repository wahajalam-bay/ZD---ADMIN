"use client";

import * as React from "react";
import { AlertTriangle, Camera, ListChecks } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { Card } from "@/components/ui/card";
import { SeverityBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Lightbox } from "@/components/ui/lightbox";
import { cn } from "@/lib/utils";
import type { Severity } from "@/lib/compliance";

export interface ReviewItemRow {
  id: string;
  index: number;
  name: string;
  op: boolean;
  cl: boolean;
  comment: string;
  severity: Severity | null;
  isIssue: boolean;
  photos: Array<{ id: string; url: string; thumbUrl: string; caption: string }>;
}

/**
 * Review body (audit V2): defects are the default view so a manager never
 * scans 20 healthy rows to find 2 problems. "All items" stays one click away.
 */
export function ChecklistReviewBody({
  rows,
  categoryName,
  entryDate,
  propertyName,
}: {
  rows: ReviewItemRow[];
  categoryName: string;
  entryDate: string;
  propertyName: string;
}) {
  const issues = rows.filter((r) => r.isIssue);
  const [tab, setTab] = React.useState<"issues" | "all">(issues.length > 0 ? "issues" : "all");
  const [lightbox, setLightbox] = React.useState<{ row: ReviewItemRow; index: number } | null>(null);

  return (
    <div>
      <div className="mb-3">
        <Segmented
          ariaLabel="Review view"
          value={tab}
          onChange={setTab}
          options={[
            { value: "issues", label: "Issues only", count: issues.length, icon: AlertTriangle },
            { value: "all", label: "All items", count: rows.length, icon: ListChecks },
          ]}
        />
      </div>

      {tab === "issues" ? (
        issues.length === 0 ? (
          <EmptyState
            icon="checkCircle"
            title="No issues were recorded in this submission"
            detail={`Every checklist point in ${categoryName} came back clean for ${entryDate}.`}
          />
        ) : (
          <div className="flex flex-col gap-2.5">
            {issues.map((row) => (
              <Card key={row.id} className="border-bad/35 p-4" data-testid={`review-issue-${row.id}`}>
                <div className="flex flex-wrap items-start gap-2.5">
                  <SeverityBadge severity={row.severity ?? "LOW"} size="sm" />
                  <div className="min-w-0 flex-1">
                    <h4 className="text-[13.5px] font-bold text-ink">{row.name}</h4>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-bad">{row.comment}</p>
                    <p className="mt-1.5 font-mono text-[10.5px] text-muted">
                      OP {row.op ? "✓" : "—"} · CL {row.cl ? "✓" : "—"}
                    </p>
                  </div>
                  {row.photos.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {row.photos.map((p, i) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setLightbox({ row, index: i })}
                          aria-label={`View evidence for ${row.name}`}
                        >
                          { }
                          <img
                            src={p.thumbUrl}
                            alt={p.caption || row.name}
                            className="h-14 w-14 rounded-tile border border-line object-cover transition-shadow hover:shadow-card-2"
                          />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-warn-bg px-2 py-1 text-[10.5px] font-bold text-warn">
                      <Camera className="h-3 w-3" aria-hidden /> No evidence
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )
      ) : (
        <Card className="overflow-hidden">
          <div className="max-h-[560px] overflow-auto">
            <table className="z-table">
              <thead className="sticky">
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Item</th>
                  <th style={{ width: 48, textAlign: "center" }}>OP</th>
                  <th style={{ width: 48, textAlign: "center" }}>CL</th>
                  <th>Issue / Comment</th>
                  <th style={{ width: 96 }}>Severity</th>
                  <th style={{ width: 128 }}>Evidence</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className={row.isIssue ? "bg-bad-bg/40" : undefined}>
                    <td className="font-mono text-[11px] text-muted">{row.index}</td>
                    <td className="font-semibold">{row.name}</td>
                    <td className={cn("text-center", row.op ? "text-accent" : "text-muted")}>
                      {row.op ? "✓" : "—"}
                    </td>
                    <td className={cn("text-center", row.cl ? "text-accent" : "text-muted")}>
                      {row.cl ? "✓" : "—"}
                    </td>
                    <td className={row.comment ? "text-bad" : "text-muted"}>{row.comment || "—"}</td>
                    <td>
                      {row.isIssue ? (
                        <SeverityBadge severity={row.severity ?? "LOW"} size="sm" />
                      ) : (
                        <span className="text-[11px] text-muted">—</span>
                      )}
                    </td>
                    <td>
                      {row.photos.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {row.photos.map((p, i) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setLightbox({ row, index: i })}
                              aria-label={`View evidence for ${row.name}`}
                            >
                              { }
                              <img
                                src={p.thumbUrl}
                                alt={p.caption || row.name}
                                className="h-9 w-9 rounded-tile border border-line object-cover"
                              />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {lightbox ? (
        <Lightbox
          items={lightbox.row.photos.map((p) => ({
            src: p.url,
            title: p.caption || lightbox.row.name,
            subtitle: `${propertyName} · ${categoryName} · ${lightbox.row.name} · ${entryDate}`,
          }))}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onNavigate={(i) => setLightbox((l) => (l ? { ...l, index: i } : l))}
        />
      ) : null}
    </div>
  );
}
