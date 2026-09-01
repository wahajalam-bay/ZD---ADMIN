"use client";

import * as React from "react";
import { ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Slide-in analytics panel (§4): focused analytics for the selected item
 * without leaving the dashboard. Right-side, Esc to close, focus trapped,
 * backdrop click closes, breadcrumb shows the drill path.
 */
export function AnalyticsPanel({
  open,
  onClose,
  title,
  subtitle,
  breadcrumb,
  actions,
  children,
  width = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  breadcrumb?: string[];
  actions?: React.ReactNode;
  children: React.ReactNode;
  width?: "md" | "lg";
}) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const restoreRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus the panel so Esc + tab order start inside it.
    const t = window.setTimeout(() => panelRef.current?.focus(), 20);

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      // Focus trap
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(t);
      restoreRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120]" role="presentation">
      <div className="anim-fade absolute inset-0 bg-[rgba(6,61,36,0.35)]" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "anim-panel absolute inset-y-0 end-0 flex w-full flex-col bg-panel shadow-panel outline-none",
          width === "lg" ? "sm:w-[640px]" : "sm:w-[500px]",
        )}
      >
        <header className="flex items-start gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0 flex-1">
            {breadcrumb && breadcrumb.length > 0 ? (
              <nav aria-label="Drill path" className="mb-1 flex flex-wrap items-center gap-1 text-[11px] text-muted">
                {breadcrumb.map((crumb, i) => (
                  <React.Fragment key={`${crumb}-${i}`}>
                    {i > 0 ? <ChevronRight className="h-3 w-3 opacity-60" aria-hidden /> : null}
                    <span className={i === breadcrumb.length - 1 ? "font-semibold text-ink" : undefined}>
                      {crumb}
                    </span>
                  </React.Fragment>
                ))}
              </nav>
            ) : null}
            <h2 className="t-card text-[15px] leading-tight">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-[12px] text-muted">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-input border border-line text-muted transition-colors hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {actions ? (
          <footer className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">{actions}</footer>
        ) : null}
      </div>
    </div>
  );
}
