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
  /** Rates compare in PERCENTAGE POINTS, counts in plain units. */
  unit?: "count" | "pp";
  /** Optional pre-formatted display, e.g. "2 resolved". */
  display?: string;
}

export type KpiVariant = "primary" | "exception" | "plain";
export type KpiTone = "green" | "orange" | "red" | "blue" | "neutral";

export interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  icon?: IconName;
  tone?: KpiTone;
  /**
   * `primary` = dark Bayut executive surface · `exception` = dark surface with
   * a semantic accent on the data · `plain` = light card for secondary metrics.
   */
  variant?: KpiVariant;
  delta?: KpiDelta | null;
  /** Shown when no comparable previous period exists (never a fake delta). */
  noComparison?: boolean;
  sparkline?: number[];
  progress?: number | null;
  hint?: string;
  onClick?: () => void;
  active?: boolean;
  className?: string;
  testId?: string;
}

const lightChip: Record<KpiTone, string> = {
  green: "bg-accent-light text-accent-dark",
  orange: "bg-warn-bg text-warn",
  red: "bg-bad-bg text-bad",
  blue: "bg-info-bg text-info",
  neutral: "bg-panel2 text-muted",
};

const lightValue: Record<KpiTone, string> = {
  green: "text-accent-dark",
  orange: "text-warn",
  red: "text-bad",
  blue: "text-info",
  neutral: "text-ink",
};

/** Accent used on the dark executive surface — bright enough for AA contrast. */
const darkAccent: Record<KpiTone, string> = {
  green: "#ffffff",
  orange: "#f7b955",
  red: "#ff8f8f",
  blue: "#8ec5f0",
  neutral: "#ffffff",
};

const sparkColor: Record<KpiTone, string> = {
  green: "var(--c1)",
  orange: "var(--c3)",
  red: "var(--red)",
  blue: "var(--c2)",
  neutral: "var(--muted)",
};

/**
 * KPI card — design system §5.1 anatomy: icon chip + label · large value ·
 * delta pill vs previous period · optional sparkline / progress-to-target.
 *
 * Executive metrics use the dark Bayut surface (`primary`/`exception`); the
 * card itself is the affordance, so there is no repeated "View details" text.
 */
export function KpiCard({
  label,
  value,
  icon,
  tone = "neutral",
  variant = "plain",
  delta,
  noComparison,
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
  const dark = variant === "primary" || variant === "exception";
  const accent = dark ? darkAccent[variant === "primary" ? "green" : tone] : undefined;

  const deltaPositive = delta ? (delta.invert ? delta.value < 0 : delta.value > 0) : false;
  const deltaNeutral = !delta || delta.value === 0;
  const DeltaIcon = deltaNeutral ? Minus : delta!.value > 0 ? ArrowUp : ArrowDown;
  const deltaText =
    delta?.display ??
    (delta
      ? `${delta.value > 0 ? "+" : ""}${delta.value}${delta.unit === "pp" ? " pp" : ""}`
      : "");

  return (
    <Comp
      {...(interactive ? { type: "button" as const, onClick, "aria-pressed": active } : {})}
      data-testid={testId}
      className={cn(
        "group relative w-full overflow-hidden rounded-card border p-4 text-start shadow-card transition-all duration-300",
        dark ? "border-[var(--kpi-dark-border)] text-white" : "border-line bg-panel",
        active && (dark ? "ring-2 ring-[#5cc08a]" : "border-accent shadow-hover"),
        interactive && "cursor-pointer hover:-translate-y-0.5 hover:shadow-card-2",
        interactive && !dark && "hover:border-line-strong",
        className,
      )}
      style={dark ? { background: "var(--kpi-dark)" } : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon ? (
            <span
              className={cn(
                "grid h-7 w-7 place-items-center rounded-tile",
                dark ? "" : lightChip[tone],
              )}
              style={dark ? { background: "var(--kpi-dark-chip)", color: accent } : undefined}
            >
              <Icon name={icon} className="h-3.5 w-3.5" />
            </span>
          ) : null}
          <span
            className="t-label"
            style={dark ? { color: "var(--kpi-dark-label)" } : undefined}
          >
            <span className={dark ? "" : "text-muted"}>{label}</span>
          </span>
        </div>
        {sparkline && sparkline.length > 1 ? (
          <Sparkline
            values={sparkline}
            stroke={dark ? (accent ?? "#5cc08a") : sparkColor[tone]}
            className="pm-hide mt-0.5"
          />
        ) : null}
      </div>

      <div className="mt-2.5 flex flex-wrap items-end gap-2">
        <span
          className={cn("t-kpi font-mono", !dark && lightValue[tone])}
          style={dark ? { color: accent } : undefined}
        >
          {value}
        </span>
        {delta ? (
          <span
            className={cn(
              "mb-1 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10.5px] font-bold",
              dark
                ? "bg-white/12"
                : deltaNeutral
                  ? "bg-panel2 text-muted"
                  : deltaPositive
                    ? "bg-accent-light text-accent-dark"
                    : "bg-warn-bg text-warn",
            )}
            style={
              dark
                ? { color: deltaNeutral ? "rgba(255,255,255,.7)" : deltaPositive ? "#7ee2ac" : "#f7b955" }
                : undefined
            }
          >
            <DeltaIcon className="h-2.5 w-2.5" aria-hidden />
            {deltaText}
            <span className="font-medium opacity-75"> {delta.label}</span>
          </span>
        ) : noComparison ? (
          <span
            className={cn(
              "mb-1 rounded-full px-1.5 py-0.5 text-[10.5px] font-medium",
              dark ? "bg-white/10 text-white/60" : "bg-panel2 text-muted",
            )}
          >
            No prior-week comparison
          </span>
        ) : null}
      </div>

      {typeof progress === "number" ? (
        <div
          className={cn(
            "mt-2.5 h-1.5 w-full overflow-hidden rounded-full",
            dark ? "bg-white/15" : "bg-[var(--neutral-track)]",
          )}
        >
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{
              width: `${Math.max(0, Math.min(100, progress))}%`,
              background: dark ? (accent ?? "#5cc08a") : sparkColor[tone],
            }}
          />
        </div>
      ) : null}

      {hint ? (
        <div
          className={cn("mt-1.5 text-[10.5px]", dark ? "" : "text-muted")}
          style={dark ? { color: "var(--kpi-dark-label)" } : undefined}
        >
          {hint}
        </div>
      ) : null}

      {/* Discoverable affordance — appears on hover only, no permanent chrome */}
      {interactive ? (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute end-3 bottom-3 text-[10px] font-bold opacity-0 transition-opacity group-hover:opacity-100",
            dark ? "text-white/70" : "text-accent-dark",
          )}
        >
          View breakdown →
        </span>
      ) : null}
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
