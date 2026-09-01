import * as React from "react";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "./icon";

/**
 * Section heading (§1.1 section title 17px/800). Uses page background as the
 * grouping device — not another card — to avoid "boxes inside boxes".
 */
export function SectionHeader({
  title,
  description,
  icon,
  actions,
  className,
}: {
  title: string;
  description?: string;
  icon?: IconName;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3.5 flex flex-wrap items-center gap-3", className)}>
      {icon ? (
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-tile bg-accent-light text-accent-dark">
          <Icon name={icon} className="h-4 w-4" />
        </span>
      ) : null}
      <div className="min-w-0">
        <h2 className="t-section text-ink">{title}</h2>
        {description ? <p className="mt-0.5 text-[11.5px] text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="ms-auto flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
