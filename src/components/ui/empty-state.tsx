import * as React from "react";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "./icon";

/**
 * Contextual empty state (§4) — copy always names the property / week /
 * next action, never a bare "No data".
 */
export function EmptyState({
  title,
  detail,
  icon = "inbox",
  className,
  children,
  compact,
}: {
  title: string;
  detail?: string;
  icon?: IconName;
  className?: string;
  children?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-card border border-dashed border-line bg-panel text-center",
        compact ? "px-4 py-6" : "px-5 py-10",
        className,
      )}
    >
      <span className="grid h-9 w-9 place-items-center rounded-tile bg-panel2 text-muted">
        <Icon name={icon} className="h-4.5 w-4.5" />
      </span>
      <p className="mt-2.5 text-[13px] font-semibold text-ink">{title}</p>
      {detail ? <p className="mt-1 max-w-md text-[12px] leading-relaxed text-muted">{detail}</p> : null}
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}
