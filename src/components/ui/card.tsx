import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-card border border-line bg-panel shadow-card", className)}
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
  return (
    <Card className={cn("px-4 py-3.5", className)}>
      <div className="mb-1 text-[10.5px] font-bold tracking-wider text-muted uppercase">
        {label}
      </div>
      <div className={cn("font-mono text-2xl font-extrabold", tones[tone])}>{value}</div>
      {hint ? <div className="mt-1 text-[10.5px] font-semibold text-accent-dark">{hint}</div> : null}
    </Card>
  );
}
