"use client";

import * as React from "react";
import { CheckCircle2, CloudUpload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SaveState =
  | { kind: "idle" }
  | { kind: "dirty" }
  | { kind: "saving" }
  | { kind: "saved"; at: string };

/**
 * Persistent action bar for long forms. Shows live save state
 * (Unsaved changes / Saving… / Saved HH:MM) and prevents duplicate submits.
 */
export function StickyFormActions({
  state,
  onSaveDraft,
  onSubmit,
  submitting,
  submitLabel = "Submit for Review",
  disabled,
  extra,
  saveTestId = "save-draft",
  submitTestId = "submit-entry",
}: {
  state: SaveState;
  onSaveDraft: () => void;
  onSubmit: () => void;
  submitting: boolean;
  submitLabel?: string;
  disabled?: boolean;
  extra?: React.ReactNode;
  saveTestId?: string;
  submitTestId?: string;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-[var(--surface)]/95 px-4 py-2.5 backdrop-blur lg:start-[236px]">
      <div
        className="mx-auto flex flex-wrap items-center justify-between gap-2"
        style={{ maxWidth: "var(--canvas-max)" }}
      >
        <span
          aria-live="polite"
          className={cn(
            "inline-flex items-center gap-1.5 text-[11.5px] font-semibold",
            state.kind === "dirty" ? "text-warn" : state.kind === "saving" ? "text-info" : "text-muted",
          )}
        >
          {state.kind === "saving" ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Saving…
            </>
          ) : state.kind === "saved" ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-accent" aria-hidden /> Saved {state.at}
            </>
          ) : state.kind === "dirty" ? (
            <>
              <CloudUpload className="h-3.5 w-3.5" aria-hidden /> Unsaved changes
            </>
          ) : (
            "All changes saved"
          )}
        </span>
        <div className="flex items-center gap-2">
          {extra}
          <Button onClick={onSaveDraft} disabled={disabled || state.kind === "saving"} data-testid={saveTestId}>
            Save Draft
          </Button>
          <Button
            variant="primary"
            onClick={onSubmit}
            disabled={disabled || submitting}
            data-testid={submitTestId}
          >
            {submitting ? "Submitting…" : submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
