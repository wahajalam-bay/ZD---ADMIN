"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * OP / CL control. Business semantics preserved exactly: OP = opening check,
 * CL = closing check (independent booleans — never re-interpreted as
 * pass/fail). Touch target is ≥40px per the mobile requirement.
 */
export function OpClToggle({
  checked,
  onChange,
  disabled,
  label,
  compact,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  /** Accessible name, e.g. "Physical Inspection opening check". */
  label: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "inline-flex items-center justify-center rounded-tile border-2 transition-all duration-150",
        compact ? "h-10 w-10" : "h-11 w-full min-w-[44px]",
        checked
          ? "border-accent bg-accent text-white shadow-[0_2px_8px_-2px_rgba(13,122,63,0.5)]"
          : "border-line bg-panel text-transparent hover:border-line-strong",
        disabled && "cursor-not-allowed opacity-55",
      )}
    >
      <Check className="h-4.5 w-4.5" aria-hidden />
    </button>
  );
}
