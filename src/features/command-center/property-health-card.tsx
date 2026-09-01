"use client";

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
  openIssues: number;
  photos: number;
  summary: string | null;
}

function Stat({
  icon: Icon,
  value,
  label,
  tone = "ink",
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: React.ReactNode;
  label: string;
  tone?: "ink" | "green" | "orange" | "red";
}) {
  const toneClass =
    tone === "green"
      ? "text-accent-dark"
      : tone === "orange"
        ? "text-warn"
        : tone === "red"
          ? "text-bad"
          : "text-ink";
  return (
    <div className="min-w-0">
      <div className={cn("flex items-center gap-1 font-mono text-[17px] leading-none font-bold", toneClass)}>
        <Icon className="h-3.5 w-3.5 opacity-70" aria-hidden />
        {value}
      </div>
      <div className="t-label mt-1 truncate text-muted">{label}</div>
    </div>
  );
}

/**
 * Property health card — analytical first, photographic second (audit P4).
 * The whole card drills into the property dashboard (§4 drill-down).
 */
export function PropertyHealthCard({ p }: { p: PropertyHealth }) {
  const needsAttention = p.openIssues > 0 || p.tracking === "AT_RISK";

  return (
    <Link
      href={`/command-center/${p.code}`}
      data-testid={`property-card-${p.code}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-card border bg-panel shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-2",
        needsAttention ? "border-warn/40 hover:border-warn" : "border-line hover:border-line-strong",
      )}
    >
      {/* Thin hero strip — context without consuming the card */}
      {p.heroUrl ? (
         
        <img src={p.heroUrl} alt="" className="h-[74px] w-full object-cover" />
      ) : (
        <div className="h-[74px] w-full bg-[var(--grad-hero)] opacity-90" aria-hidden />
      )}

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-[15.5px] leading-tight font-bold text-ink group-hover:text-accent-dark">
              {p.name}
            </h3>
            <p className="mt-0.5 truncate text-[11px] text-muted">{p.meta}</p>
          </div>
          <TrackingBadge status={p.tracking} size="sm" />
        </div>

        <div className="mt-3.5 grid grid-cols-3 gap-3 border-t border-line pt-3">
          <Stat icon={Check} value={p.completed} label="Completed" tone="green" />
          <Stat icon={Loader} value={p.inProcess} label="In Process" tone="orange" />
          <Stat
            icon={ShieldCheck}
            value={p.compliancePct === null ? "—" : `${p.compliancePct}%`}
            label="Compliance"
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3">
          <Stat
            icon={AlertTriangle}
            value={p.openIssues}
            label="Open Issues"
            tone={p.openIssues > 0 ? "red" : "ink"}
          />
          <Stat icon={Camera} value={p.photos} label="Photos" />
        </div>

        {p.summary ? (
          <p className="mt-3 line-clamp-2 border-t border-line pt-2.5 text-[11.5px] leading-relaxed text-muted">
            {p.summary}
          </p>
        ) : null}

        <span className="mt-3 inline-flex items-center gap-1 text-[11.5px] font-bold text-accent-dark opacity-0 transition-opacity group-hover:opacity-100">
          Open property <ArrowRight className="h-3 w-3" aria-hidden />
        </span>
      </div>
    </Link>
  );
}
