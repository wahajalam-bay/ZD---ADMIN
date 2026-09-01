"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/**
 * Accessible modal dialog built on the native <dialog> element:
 * focus containment, Escape-to-close and backdrop dismissal for free.
 */
export function Dialog({
  open,
  onClose,
  title,
  subtitle,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto w-full rounded-xl border border-line bg-panel p-0 text-ink shadow-2xl backdrop:bg-slate-950/55",
        wide ? "max-w-3xl" : "max-w-lg",
      )}
    >
      {open ? (
        <>
          <div className="flex items-start justify-between border-b border-line px-5 py-4">
            <div>
              <h3 className="text-[15px] font-bold">{title}</h3>
              {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
            </div>
            <Button size="sm" aria-label="Close dialog" onClick={onClose}>
              <X className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </div>
          <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        </>
      ) : null}
    </dialog>
  );
}
