import * as React from "react";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "./icon";

/**
 * Content card (§1.4: 16px radius, 16–18px padding, sh-1 default).
 * Cards are for contained information units only — layout grouping uses
 * section headers on the page background instead.
 */
export function Card({
  className,
  interactive,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-card border border-line bg-panel shadow-card",
        interactive &&
          "transition-all duration-300 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-card-2",
        className,
      )}
      {...props}
    />
  );
}

/** Card header row: optional icon chip + title + right-side slot. */
export function CardHeader({
  title,
  subtitle,
  icon,
  actions,
  className,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      {icon ? (
        <span className="grid h-6.5 w-6.5 shrink-0 place-items-center rounded-tile bg-accent-light p-1 text-accent-dark">
          <Icon name={icon} className="h-3.5 w-3.5" />
        </span>
      ) : null}
      <div className="min-w-0">
        <h3 className="t-card text-ink">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-[11.5px] text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="ms-auto flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Chart container: title + optional analytical question + chart body. */
export function ChartCard({
  title,
  question,
  actions,
  icon,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  question?: string;
  actions?: React.ReactNode;
  icon?: IconName;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Card className={cn("p-4", className)}>
      <CardHeader title={title} subtitle={question} icon={icon} actions={actions} />
      <div className={cn("mt-3", bodyClassName)}>{children}</div>
    </Card>
  );
}
