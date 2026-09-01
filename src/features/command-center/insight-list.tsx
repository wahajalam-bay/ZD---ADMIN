"use client";

import * as React from "react";
import { ArrowRight, CheckCircle2, Info, Siren, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export type InsightTone = "neutral" | "positive" | "warning" | "critical";

export interface InsightFocus {
  kind: "property" | "issues" | "compliance" | "tasks";
  value?: string;
}

/** Client-side shape of a server `Insight` (plain data — RSC serialisable). */
export interface InsightView {
  id: string;
  tone: InsightTone;
  text: string;
  focus?: InsightFocus;
}

const toneMeta: Record<
  InsightTone,
  { icon: React.ComponentType<{ className?: string }>; chip: string; bar: string; label: string }
> = {
  critical: { icon: Siren, chip: "bg-bad-bg text-bad", bar: "bg-bad", label: "Critical" },
  warning: { icon: TriangleAlert, chip: "bg-warn-bg text-warn", bar: "bg-warn", label: "Watch" },
  positive: {
    icon: CheckCircle2,
    chip: "bg-accent-light text-accent-dark",
    bar: "bg-accent",
    label: "Positive",
  },
  neutral: { icon: Info, chip: "bg-panel2 text-muted", bar: "bg-line-strong", label: "Note" },
};

/**
 * Management insights (§6). Every sentence is computed server-side from
 * published records; an insight with a `focus` is clickable and drives the
 * board's cross-filter / drill-down state.
 */
export function InsightList({
  insights,
  onFocus,
  className,
}: {
  insights: InsightView[];
  onFocus?: (focus: InsightFocus) => void;
  className?: string;
}) {
  if (insights.length === 0) return null;

  return (
    <ul
      className={cn("grid gap-2.5 md:grid-cols-2 xl:grid-cols-3", className)}
      data-testid="insight-list"
    >
      {insights.map((insight) => {
        const meta = toneMeta[insight.tone];
        const MetaIcon = meta.icon;
        const clickable = Boolean(insight.focus && onFocus);

        const body = (
          <>
            <span
              aria-hidden
              className={cn("absolute inset-y-0 start-0 w-[3px] rounded-s-card", meta.bar)}
            />
            <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-tile", meta.chip)}>
              <MetaIcon className="h-3.5 w-3.5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="sr-only">{meta.label}: </span>
              <span className="block text-[12.5px] leading-relaxed text-ink">{insight.text}</span>
            </span>
            {clickable ? (
              <ArrowRight
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100"
                aria-hidden
              />
            ) : null}
          </>
        );

        return (
          <li key={insight.id}>
            {clickable ? (
              <button
                type="button"
                data-testid={`insight-${insight.id}`}
                onClick={() => onFocus!(insight.focus!)}
                className="group relative flex h-full w-full items-start gap-2.5 overflow-hidden rounded-card border border-line bg-panel py-2.5 ps-4 pe-3 text-start shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-card-2"
              >
                {body}
              </button>
            ) : (
              <div
                data-testid={`insight-${insight.id}`}
                className="group relative flex h-full items-start gap-2.5 overflow-hidden rounded-card border border-line bg-panel py-2.5 ps-4 pe-3 shadow-card"
              >
                {body}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
