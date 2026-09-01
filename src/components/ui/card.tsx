import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "bg-grad-surface rounded-card border border-line shadow-card transition-shadow duration-300",
        className,
      )}
      {...props}
    />
  );
}

export function Kpi({
  label,
  value,
  tone = "ink",
  hint,
  className,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "ink" | "ok" | "warn" | "bad";
  hint?: string;
  className?: string;
}) {
  const tones = {
    ink: "text-ink",
    ok: "text-accent-dark",
    warn: "text-warn",
    bad: "text-bad",
  } as const;
  const bars = {
    ink: "var(--grad-green)",
    ok: "var(--grad-green)",
    warn: "linear-gradient(135deg,#d97706,#b45309)",
    bad: "linear-gradient(135deg,#ef4444,#dc2626)",
  } as const;
  return (
    <Card
      className={cn(
        "relative overflow-hidden px-4 py-3.5 hover:-translate-y-1 hover:border-gsoft hover:shadow-hover",
        "transition-all duration-300",
        className,
      )}
    >
      {/* Kit KPI accent bar */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-[3px] opacity-90"
        style={{ background: bars[tone] }}
      />
      <div className="mb-1 text-[10.5px] font-semibold tracking-wider text-muted uppercase">
        {label}
      </div>
      <div className={cn("font-mono text-2xl font-bold", tones[tone])}>{value}</div>
      {hint ? <div className="mt-1 text-[10.5px] font-semibold text-accent-dark">{hint}</div> : null}
    </Card>
  );
}
