"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Camera, Check, Loader, ShieldCheck } from "lucide-react";
import { TrackingBadge, type Tracking } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

export interface PropertyHealth {
  code: string;
  name: string;
  meta: string;
  heroUrl: string | null;
  tracking: Tracking | null;
  completed: number;
  inProcess: number;
  compliancePct: number | null;
  complianceClean: number;
  complianceFlagged: number;
  complianceTotal: number;
  openIssues: number;
  photos: number;
  summary: string | null;
  /** Previous-week task counts, null when there is no comparable week. */
  prevCompleted?: number | null;
  prevInProcess?: number | null;
}

export type PropertyMetric = "completed" | "inProcess" | "compliance" | "issues" | "photos";

function Stat({
  icon: Icon,
  value,
  label,
  hint,
  tone = "ink",
  onClick,
  testId,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: React.ReactNode;
  label: string;
  hint?: string;
  tone?: "ink" | "green" | "orange" | "red";
  onClick?: () => void;
  testId?: string;
}) {
  const toneClass =
    tone === "green"
      ? "text-accent-dark"
      : tone === "orange"
        ? "text-warn"
        : tone === "red"
          ? "text-bad"
          : "text-ink";

  const body = (
    <>
      <span
        className={cn(
          "flex items-center gap-1 font-mono text-[17px] leading-none font-bold",
          toneClass,
        )}
      >
        <Icon className="h-3.5 w-3.5 opacity-70" aria-hidden />
        {value}
      </span>
      <span className="t-label mt-1 block truncate text-muted">{label}</span>
    </>
  );

  if (!onClick) {
    return <span className="block min-w-0">{body}</span>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      title={hint}
      aria-label={`${label}: ${value}. View breakdown.`}
      className="-mx-1.5 -my-1 min-w-0 rounded-input px-1.5 py-1 text-start transition-colors hover:bg-panel2 focus-visible:bg-panel2"
    >
      {body}
    </button>
  );
}

/**
 * Property health card — analytical first, photographic second (audit P4).
 * The title drills into the property dashboard; each metric opens the matching
 * portfolio breakdown filtered to this property (§3/§4), so the card is a
 * container of links rather than one nested-interactive block.
 */
export function PropertyHealthCard({
  p,
  week,
  onMetric,
}: {
  p: PropertyHealth;
  week?: string;
  onMetric?: (metric: PropertyMetric) => void;
}) {
  const needsAttention = p.openIssues > 0 || p.tracking === "AT_RISK";
  const href = week ? `/command-center/${p.code}?week=${week}` : `/command-center/${p.code}`;
  const metric = (m: PropertyMetric) => (onMetric ? () => onMetric(m) : undefined);

  return (
    <div
      data-testid={`property-card-${p.code}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-card border bg-panel shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-2",
        needsAttention ? "border-warn/40 hover:border-warn" : "border-line hover:border-line-strong",
      )}
    >
      {/* Thin hero strip — context without consuming the card */}
      <Link href={href} tabIndex={-1} aria-hidden className="block">
        {p.heroUrl ? (
          <img src={p.heroUrl} alt="" className="h-[74px] w-full object-cover" />
        ) : (
          <span className="block h-[74px] w-full bg-[image:var(--grad-hero)] opacity-90" />
        )}
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-[15.5px] leading-tight font-bold">
              <Link
                href={href}
                data-testid={`property-link-${p.code}`}
                className="text-ink transition-colors hover:text-accent-dark"
              >
                {p.name}
              </Link>
            </h3>
            <p className="mt-0.5 truncate text-[11px] text-muted">{p.meta}</p>
          </div>
          <TrackingBadge status={p.tracking} size="sm" />
        </div>

        <div className="mt-3.5 grid grid-cols-3 gap-3 border-t border-line pt-3">
          <Stat
            icon={Check}
            value={p.completed}
            label="Completed"
            tone="green"
            onClick={metric("completed")}
            testId={`stat-completed-${p.code}`}
          />
          <Stat
            icon={Loader}
            value={p.inProcess}
            label="In Process"
            tone="orange"
            onClick={metric("inProcess")}
            testId={`stat-in-process-${p.code}`}
          />
          <Stat
            icon={ShieldCheck}
            value={p.compliancePct === null ? "—" : `${p.compliancePct}%`}
            label="Compliance"
            hint={
              p.complianceTotal > 0
                ? `${p.complianceClean} clean of ${p.complianceTotal} checklist points`
                : "No published checklist points this week"
            }
            onClick={metric("compliance")}
            testId={`stat-compliance-${p.code}`}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3">
          <Stat
            icon={AlertTriangle}
            value={p.openIssues}
            label="Open Issues"
            tone={p.openIssues > 0 ? "red" : "ink"}
            onClick={metric("issues")}
            testId={`stat-issues-${p.code}`}
          />
          <Stat
            icon={Camera}
            value={p.photos}
            label="Photos"
            onClick={metric("photos")}
            testId={`stat-photos-${p.code}`}
          />
        </div>

        {p.summary ? (
          <p className="mt-3 line-clamp-2 border-t border-line pt-2.5 text-[11.5px] leading-relaxed text-muted">
            {p.summary}
          </p>
        ) : null}

        <Link
          href={href}
          className="mt-3 inline-flex items-center gap-1 self-start text-[11.5px] font-bold text-accent-dark opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        >
          Open property <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
