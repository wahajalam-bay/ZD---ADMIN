import * as React from "react";
import { cn } from "@/lib/utils";
import type { WorkflowStatus } from "@/lib/roles";
import type { Severity } from "@/lib/compliance";

export function Badge({
  className,
  children,
  title,
}: {
  className?: string;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap",
        className,
      )}
    >
      {children}
    </span>
  );
}

const workflowStyles: Record<WorkflowStatus, string> = {
  DRAFT: "bg-warn-bg text-warn",
  SUBMITTED: "bg-info-bg text-info",
  RETURNED: "bg-bad-bg text-bad",
  APPROVED: "bg-accent-light text-accent-dark",
  PUBLISHED: "bg-ink text-white",
};

const workflowLabels: Record<WorkflowStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  RETURNED: "Returned",
  APPROVED: "Approved",
  PUBLISHED: "Published",
};

export function StatusBadge({ status }: { status: WorkflowStatus | null }) {
  if (!status) return <Badge className="bg-slate-100 text-muted">Not started</Badge>;
  return <Badge className={workflowStyles[status]}>{workflowLabels[status]}</Badge>;
}

const trackingStyles = {
  ON_TRACK: "bg-accent-light text-accent-dark",
  WATCH: "bg-warn-bg text-warn",
  AT_RISK: "bg-bad-bg text-bad",
} as const;

export const TRACKING_LABELS = {
  ON_TRACK: "On track",
  WATCH: "Watch",
  AT_RISK: "At risk",
} as const;

export function TrackingBadge({
  status,
}: {
  status: keyof typeof trackingStyles | null;
}) {
  if (!status) return <Badge className="bg-slate-100 text-muted">No report</Badge>;
  return <Badge className={trackingStyles[status]}>{TRACKING_LABELS[status]}</Badge>;
}

const severityStyles: Record<Severity, string> = {
  LOW: "bg-slate-100 text-slate-600",
  MEDIUM: "bg-warn-bg text-warn",
  HIGH: "bg-bad-bg text-bad",
  CRITICAL: "bg-bad text-white",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  const labels: Record<Severity, string> = {
    LOW: "Low",
    MEDIUM: "Medium",
    HIGH: "High",
    CRITICAL: "Critical",
  };
  return <Badge className={severityStyles[severity]}>{labels[severity]}</Badge>;
}

export function TaskStatusBadge({ status }: { status: "COMPLETED" | "IN_PROCESS" }) {
  return status === "COMPLETED" ? (
    <Badge className="bg-accent-light text-accent-dark">Completed</Badge>
  ) : (
    <Badge className="bg-warn-bg text-warn">In Process</Badge>
  );
}
