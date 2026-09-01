"use client";

import * as React from "react";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CountsBar, DonutStat, CHART_COLORS } from "./charts";
import { formatNumber } from "@/lib/utils";

/** Serializable PropOne widget payload prepared by the server page. */
export interface PropOneWidgetView {
  domain: string;
  label: string;
  kpis: Array<{ label: string; value: string; tone?: "ok" | "warn" | "bad" }>;
  chart?:
    | { kind: "bar"; data: Array<{ name: string; value: number }> }
    | { kind: "donut"; slices: Array<{ name: string; value: number; color: string }>; center: string; centerLabel: string };
  note?: string;
  detail?: {
    title: string;
    note?: string;
    columns: string[];
    rows: string[][];
    statusColumn?: number;
  };
}

function statusTone(value: string): string {
  const v = value.trim().toLowerCase();
  if (v === "completed" || v === "verified" || v === "attended") return "bg-accent-light text-accent-dark";
  if (v === "rejected" || v === "cancelled" || v === "canceled") return "bg-bad-bg text-bad";
  return "bg-warn-bg text-warn";
}

export function PropOneWidgets({ widgets }: { widgets: PropOneWidgetView[] }) {
  const [detail, setDetail] = React.useState<PropOneWidgetView | null>(null);

  if (widgets.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-line bg-panel px-5 py-8 text-center text-[13px] text-muted">
        No PropOne widgets are enabled for this property. A Manager/Admin can enable
        data domains at Admin → Integrations once PropOne data is available.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {widgets.map((w) => (
        <div key={w.domain} className="rounded-card border border-line bg-panel p-5 shadow-card">
          <div className="mb-3 text-[12px] font-bold tracking-wide text-muted uppercase">
            PropOne — {w.label}
          </div>
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {w.kpis.map((k) => (
              <button
                key={k.label}
                onClick={() => w.detail && setDetail(w)}
                disabled={!w.detail}
                className="rounded-card border border-line bg-panel px-3.5 py-3 text-left transition enabled:cursor-pointer enabled:hover:-translate-y-0.5 enabled:hover:border-accent enabled:hover:shadow-md"
              >
                <div className="mb-1 text-[10.5px] font-bold tracking-wide text-muted uppercase">{k.label}</div>
                <div
                  className={
                    "font-mono text-xl font-extrabold " +
                    (k.tone === "ok" ? "text-accent-dark" : k.tone === "warn" ? "text-warn" : k.tone === "bad" ? "text-bad" : "text-ink")
                  }
                >
                  {k.value}
                </div>
                {w.detail ? (
                  <div className="mt-1 text-[10px] font-bold text-accent-dark">View details →</div>
                ) : null}
              </button>
            ))}
          </div>
          {w.chart ? (
            <div className="rounded-card border border-dashed border-line p-4">
              {w.chart.kind === "bar" ? (
                <CountsBar data={w.chart.data} ariaLabel={`${w.label} chart`} />
              ) : (
                <DonutStat
                  slices={w.chart.slices}
                  centerValue={w.chart.center}
                  centerLabel={w.chart.centerLabel}
                  ariaLabel={`${w.label} status chart`}
                />
              )}
            </div>
          ) : null}
          {w.note ? (
            <div className="mt-3 border-t border-line pt-2.5 text-[13px] leading-relaxed text-ink">{w.note}</div>
          ) : null}
        </div>
      ))}

      <Dialog
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detail?.detail?.title ?? ""}
        subtitle={detail?.detail?.note}
        wide
      >
        {detail?.detail ? (
          <div className="overflow-x-auto">
            <table className="z-table min-w-[620px]">
              <thead>
                <tr>
                  {detail.detail.columns.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {detail.detail.rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) =>
                      j === detail.detail!.statusColumn ? (
                        <td key={j}>
                          <Badge className={statusTone(cell)}>{cell}</Badge>
                        </td>
                      ) : (
                        <td key={j}>{cell}</td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}

export { formatNumber, CHART_COLORS };
