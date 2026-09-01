import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Crumb {
  label: string;
  href?: string;
}

/**
 * Sticky page header (§1.3 glass allowed on headers). Left: breadcrumb/context
 * + title. Right: reporting controls, mode controls, utilities.
 */
export function PageHeader({
  eyebrow,
  title,
  breadcrumb,
  meta,
  controls,
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  breadcrumb?: Crumb[];
  /** Secondary metadata line (properties, area, last published…). */
  meta?: React.ReactNode;
  controls?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "glass sticky top-14 z-30 mb-5 rounded-shell px-4 py-3 shadow-card-2 lg:top-2 lg:px-5 lg:py-3.5",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {breadcrumb && breadcrumb.length > 0 ? (
            <nav aria-label="Breadcrumb" className="mb-1 flex flex-wrap items-center gap-1 text-[11px]">
              {breadcrumb.map((c, i) => (
                <React.Fragment key={`${c.label}-${i}`}>
                  {i > 0 ? <ChevronRight className="h-3 w-3 text-muted/60" aria-hidden /> : null}
                  {c.href ? (
                    <Link
                      href={c.href}
                      className="inline-flex min-h-8 items-center font-semibold text-accent-dark hover:underline sm:min-h-0"
                    >
                      {c.label}
                    </Link>
                  ) : (
                    <span className="text-muted">{c.label}</span>
                  )}
                </React.Fragment>
              ))}
            </nav>
          ) : eyebrow ? (
            <div className="t-label mb-1 text-muted">{eyebrow}</div>
          ) : null}
          <h1 className="text-[21px] leading-tight font-extrabold text-ink">{title}</h1>
          {meta ? <div className="mt-1 text-[11.5px] text-muted">{meta}</div> : null}
        </div>
        {controls ? <div className="flex flex-wrap items-center gap-2">{controls}</div> : null}
      </div>
      {children ? <div className="mt-3">{children}</div> : null}
    </header>
  );
}
