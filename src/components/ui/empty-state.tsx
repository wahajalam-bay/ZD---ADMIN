import * as React from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  detail,
  className,
  children,
}: {
  title: string;
  detail?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-card border border-dashed border-line bg-panel px-5 py-9 text-center",
        className,
      )}
    >
      <p className="text-[13px] font-semibold text-ink">{title}</p>
      {detail ? <p className="mt-1 text-xs text-muted">{detail}</p> : null}
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}
