"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  count?: number;
  tone?: "green" | "orange" | "red" | "blue";
}

/**
 * Segmented control (§5.2 period chips / toggles). Used for publication state,
 * review-queue status, issue filters — selection is unmistakable.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  ariaLabel,
  className,
}: {
  options: Array<SegmentOption<T>>;
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-line bg-panel2 p-1",
        className,
      )}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            role="tab"
            type="button"
            aria-selected={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap transition-all duration-200",
              size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3.5 py-1.5 text-[12px]",
              selected
                ? "bg-panel text-ink shadow-card"
                : "text-muted hover:text-ink",
            )}
          >
            {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null}
            {opt.label}
            {typeof opt.count === "number" ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-px font-mono text-[10px]",
                  selected ? "bg-accent-light text-accent-dark" : "bg-panel text-muted",
                )}
              >
                {opt.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
