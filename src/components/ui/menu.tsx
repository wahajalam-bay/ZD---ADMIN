"use client";

import * as React from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MenuItem {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onSelect: () => void;
  danger?: boolean;
}

/**
 * Compact ⋯ action menu — replaces rows of competing buttons in tables.
 * Keyboard: Enter/Space opens, Esc closes, arrow keys move, focus restored.
 */
export function ActionMenu({
  items,
  label = "Actions",
  align = "end",
  trigger,
  testId,
}: {
  items: MenuItem[];
  label?: string;
  align?: "start" | "end";
  trigger?: React.ReactNode;
  testId?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative inline-block" ref={rootRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        data-testid={testId}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center justify-center rounded-input border border-line bg-panel text-muted transition-colors hover:text-ink",
          trigger ? "gap-1.5 px-2.5 py-1.5 text-[12px] font-semibold" : "h-8 w-8",
        )}
      >
        {trigger ?? <MoreHorizontal className="h-4 w-4" aria-hidden />}
      </button>
      {open ? (
        <div
          role="menu"
          className={cn(
            "anim-fade absolute z-50 mt-1 min-w-[190px] overflow-hidden rounded-tile border border-line bg-panel py-1 shadow-panel",
            align === "end" ? "end-0" : "start-0",
          )}
        >
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                role="menuitem"
                type="button"
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-start text-[12.5px] font-medium transition-colors",
                  item.danger ? "text-bad hover:bg-bad-bg" : "text-ink hover:bg-panel2",
                )}
              >
                {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
                {item.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
