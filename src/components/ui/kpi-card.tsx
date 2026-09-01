"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sparkline } from "./sparkline";
import { Icon, type IconName } from "./icon";

export interface KpiDelta {
  /** Signed change vs the previous period. */
  value: number;
  /** Suffix, e.g. "vs last week". */
  label: string;
  /** When true a negative delta is the good outcome (e.g. open issues). */
  invert?: boolean;
  /** Optional pre-formatted display, e.g. "2 resolved". */
  display?: string;
}

export interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  icon?: IconName;
  tone?: "green" | "orange" | "red" | "blue" | "neutral";
  delta?: KpiDelta | null;
  sparkline?: number[];
  /** Progress-to-target bar 0–100 (§5.1 optional micro-viz). */
  progress?: number | null;
  hint?: string;
  onClick?: () => void;
  active?: boolean;
  className?: string;
  testId?: string;
}

const toneRing: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  green: "bg-accent-light text-accent-dark",
  orange: "bg-warn-bg text-warn",
  red: "bg-bad-bg text-bad",
  blue: "bg-info-bg text-info",
  neutral: "bg-panel2 text-muted",
};

const toneValue: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  green: "text-accent-dark",
  orange: "text-warn",
  red: "text-bad",
  blue: "text-info",
  neutral: "text-ink",
};

const toneSpark: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  green: "var(--c1)",
  orange: "var(--c3)",
  red: "var(--red)",
  blue: "var(--c2)",
  neutral: "var(--muted)",
};

/**
 * KPI card — design system §5.1 anatomy:
 * icon chip + label · large value (700) · delta pill vs previous period ·
 * optional sparkline / progress-to-target. The whole card is the affordance
 * (no repeated "View details" link); clicking cross-filters or opens the
 * metric's analytics panel (§4).
 */
export function KpiCard({
  label,
  value,
  icon,
  tone = "neutral",
  delta,
  sparkline,
  progress,
  hint,
  onClick,
  active,
  className,
  testId,
}: KpiCardProps) {
  const interactive = typeof onClick === "function";
  const Comp = interactive ? "button" : "div";

  const deltaPositive = delta ? (delta.invert ? delta.value < 0 : delta.value > 0) : false;
  const deltaNeutral = !delta || delta.value === 0;
  const DeltaIcon = deltaNeutral ? Minus : delta!.value > 0 ? ArrowUp : ArrowDown;

  return (
    <Comp
      {...(interactive ? { type: "button" as const, onClick, "aria-pressed": active } : {})}
      data-testid={testId}
      className={cn(
        "relative w-full overflow-hidden rounded-card border bg-panel p-4 text-start shadow-card transition-all duration-300",
        active ? "border-accent shadow-hover" : "border-line",
        interactive && "cursor-pointer hover:-translate-y-0.5 hover:border-line-strong hover:shadow-card-2",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon ? (
            <span className={cn("grid h-7 w-7 place-items-center rounded-tile", toneRing[tone])}>
              <Icon name={icon} className="h-3.5 w-3.5" />
            </span>
          ) : null}
          <span className="t-label text-muted">{label}</span>
        </div>
        {sparkline && sparkline.length > 1 ? (
          <Sparkline values={sparkline} stroke={toneSpark[tone]} className="pm-hide mt-0.5" />
        ) : null}
      </div>

      <div className="mt-2.5 flex flex-wrap items-end gap-2">
        <span className={cn("t-kpi font-mono", toneValue[tone])}>{value}</span>
        {delta ? (
          <span
            className={cn(
              "mb-1 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10.5px] font-bold",
              deltaNeutral
                ? "bg-panel2 text-muted"
                : deltaPositive
                  ? "bg-accent-light text-accent-dark"
                  : "bg-warn-bg text-warn",
            )}
          >
            <DeltaIcon className="h-2.5 w-2.5" aria-hidden />
            {delta.display ?? `${delta.value > 0 ? "+" : ""}${delta.value}`}
            <span className="font-medium opacity-75"> {delta.label}</span>
          </span>
        ) : null}
      </div>

      {typeof progress === "number" ? (
        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--neutral-track)]">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{
              width: `${Math.max(0, Math.min(100, progress))}%`,
              background: toneSpark[tone],
            }}
          />
        </div>
      ) : null}

      {hint ? <div className="mt-1.5 text-[10.5px] text-muted">{hint}</div> : null}
    </Comp>
  );
}

/** Responsive KPI strip wrapper (§1.4 grid gap 12/16). */
export function KpiStrip({
  children,
  cols = 5,
  className,
}: {
  children: React.ReactNode;
  cols?: 4 | 5 | 6;
  className?: string;
}) {
  const colClass =
    cols === 4
      ? "sm:grid-cols-2 lg:grid-cols-4"
      : cols === 6
        ? "sm:grid-cols-3 lg:grid-cols-6"
        : "sm:grid-cols-3 lg:grid-cols-5";
  return <div className={cn("grid grid-cols-2 gap-3", colClass, className)}>{children}</div>;
}
