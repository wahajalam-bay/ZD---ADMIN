"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Cross-filter chip (§7). The pressed state is announced via `aria-pressed`
 * and reinforced with weight + border, so the filter is never colour-only.
 */
export function FilterChip({
  active,
  onClick,
  count,
  children,
  className,
}: {
  active?: boolean;
  onClick: () => void;
  count?: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        // 36px tap target on phones, dense chip from `sm` up.
        "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] transition-colors sm:min-h-0 sm:px-2.5 sm:py-1 sm:text-[11.5px]",
        active
          ? "border-transparent bg-accent-deep font-bold text-white"
          : "border-line bg-panel font-semibold text-muted hover:border-line-strong hover:text-ink",
        className,
      )}
    >
      {children}
      {typeof count === "number" ? (
        <span
          className={cn(
            "rounded-full px-1.5 font-mono text-[10px] font-bold",
            active ? "bg-white/20 text-white" : "bg-panel2 text-muted",
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}
