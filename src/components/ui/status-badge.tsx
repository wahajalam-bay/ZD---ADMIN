import * as React from "react";
import {
  AlertTriangle,
  ArrowUpCircle,
  Check,
  CircleDot,
  CircleSlash,
  Clock,
  FileEdit,
  Info,
  Loader,
  RotateCcw,
  ShieldCheck,
  Siren,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkflowStatus } from "@/lib/roles";
import type { Severity } from "@/lib/compliance";

/**
 * One unified badge system (§5.2): every status is hue + icon + label, never
 * colour alone (§8 encoding rule). Tones map to the semantic tokens.
 */
type Tone = "green" | "orange" | "red" | "blue" | "neutral" | "deep";

const toneClass: Record<Tone, string> = {
  green: "bg-accent-light text-accent-dark border-accent/25",
  orange: "bg-warn-bg text-warn border-warn/25",
  red: "bg-bad-bg text-bad border-bad/25",
  blue: "bg-info-bg text-info border-info/25",
  neutral: "bg-panel2 text-muted border-line",
  deep: "bg-accent-deep text-white border-transparent",
};

export function Badge({
  tone = "neutral",
  icon: Icon,
  children,
  className,
  size = "md",
}: {
  tone?: Tone;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-semibold whitespace-nowrap",
        size === "sm" ? "px-2 py-0.5 text-[10.5px]" : "px-2.5 py-1 text-[11px]",
        toneClass[tone],
        className,
      )}
    >
      {Icon ? <Icon className="h-3 w-3 shrink-0" aria-hidden /> : null}
      {children}
    </span>
  );
}

// ── Workflow ────────────────────────────────────────────────────────────────

const workflowMeta: Record<WorkflowStatus, { tone: Tone; label: string; icon: React.ComponentType<{ className?: string }> }> = {
  DRAFT: { tone: "orange", label: "Draft", icon: FileEdit },
  SUBMITTED: { tone: "blue", label: "Submitted", icon: Clock },
  RETURNED: { tone: "red", label: "Returned", icon: RotateCcw },
  APPROVED: { tone: "green", label: "Approved", icon: ShieldCheck },
  PUBLISHED: { tone: "deep", label: "Published", icon: Upload },
};

export function StatusBadge({
  status,
  size = "md",
}: {
  status: WorkflowStatus | null;
  size?: "sm" | "md";
}) {
  if (!status) {
    return (
      <Badge tone="neutral" icon={CircleSlash} size={size}>
        Not started
      </Badge>
    );
  }
  const m = workflowMeta[status];
  return (
    <Badge tone={m.tone} icon={m.icon} size={size}>
      {m.label}
    </Badge>
  );
}

// ── Weekly tracking ─────────────────────────────────────────────────────────

export type Tracking = "ON_TRACK" | "WATCH" | "AT_RISK";

export const TRACKING_LABELS: Record<Tracking, string> = {
  ON_TRACK: "On track",
  WATCH: "Watch",
  AT_RISK: "At risk",
};

const trackingMeta: Record<Tracking, { tone: Tone; icon: React.ComponentType<{ className?: string }> }> = {
  ON_TRACK: { tone: "green", icon: CircleDot },
  WATCH: { tone: "orange", icon: AlertTriangle },
  AT_RISK: { tone: "red", icon: Siren },
};

export function TrackingBadge({
  status,
  size = "md",
}: {
  status: Tracking | null;
  size?: "sm" | "md";
}) {
  if (!status) {
    return (
      <Badge tone="neutral" icon={CircleSlash} size={size}>
        No report
      </Badge>
    );
  }
  const m = trackingMeta[status];
  return (
    <Badge tone={m.tone} icon={m.icon} size={size}>
      {TRACKING_LABELS[status]}
    </Badge>
  );
}

/**
 * Small dot + accessible label for property status. `onDark` brightens the cue
 * for the dark navigation surface; the accessible label always carries the
 * meaning so colour is never the only signal (§8).
 */
export function TrackingDot({ status, onDark }: { status: Tracking | null; onDark?: boolean }) {
  const color =
    status === "ON_TRACK"
      ? onDark
        ? "bg-[#5cc08a]"
        : "bg-accent"
      : status === "WATCH"
        ? onDark
          ? "bg-[#f0a850]"
          : "bg-warn"
        : status === "AT_RISK"
          ? onDark
            ? "bg-[#f87171]"
            : "bg-bad"
          : onDark
            ? "bg-white/30"
            : "bg-line-strong";
  return (
    <span
      className={cn("h-2 w-2 shrink-0 rounded-full", color)}
      role="img"
      aria-label={status ? TRACKING_LABELS[status] : "No weekly report"}
    />
  );
}

// ── Task status ─────────────────────────────────────────────────────────────

export function TaskStatusBadge({
  status,
  size = "md",
}: {
  status: "COMPLETED" | "IN_PROCESS";
  size?: "sm" | "md";
}) {
  return status === "COMPLETED" ? (
    <Badge tone="green" icon={Check} size={size}>
      Completed
    </Badge>
  ) : (
    <Badge tone="orange" icon={Loader} size={size}>
      In Process
    </Badge>
  );
}

// ── Severity ────────────────────────────────────────────────────────────────

const severityMeta: Record<Severity, { tone: Tone; label: string; icon: React.ComponentType<{ className?: string }> }> = {
  LOW: { tone: "neutral", label: "Low", icon: Info },
  MEDIUM: { tone: "orange", label: "Medium", icon: AlertTriangle },
  HIGH: { tone: "red", label: "High", icon: ArrowUpCircle },
  CRITICAL: { tone: "red", label: "Critical", icon: Siren },
};

export function SeverityBadge({
  severity,
  size = "md",
}: {
  severity: Severity;
  size?: "sm" | "md";
}) {
  const m = severityMeta[severity];
  return (
    <Badge
      tone={m.tone}
      icon={m.icon}
      size={size}
      className={severity === "CRITICAL" ? "bg-bad text-white border-transparent" : undefined}
    >
      {m.label}
    </Badge>
  );
}

/** Generic PropOne / external status → tone mapping with an icon cue. */
export function SourceStatusBadge({ status, size = "sm" }: { status: string; size?: "sm" | "md" }) {
  const s = status.trim().toLowerCase();
  if (["completed", "attended", "verified", "approved", "confirmed"].includes(s)) {
    return (
      <Badge tone="green" icon={Check} size={size}>
        {status}
      </Badge>
    );
  }
  if (["rejected", "cancelled", "canceled", "failed", "expired"].includes(s)) {
    return (
      <Badge tone="red" icon={CircleSlash} size={size}>
        {status}
      </Badge>
    );
  }
  if (["pending", "pending procurement", "in progress", "pre-booked", "prebooked"].includes(s)) {
    return (
      <Badge tone="orange" icon={Clock} size={size}>
        {status}
      </Badge>
    );
  }
  return (
    <Badge tone="blue" icon={Info} size={size}>
      {status}
    </Badge>
  );
}
