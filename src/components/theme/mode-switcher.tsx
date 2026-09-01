"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "./theme-provider";
import { cn } from "@/lib/utils";

/**
 * Mode controls (§7). Presentation is offered only where it makes sense
 * (management surfaces) — the caller decides via `showPresentation`.
 */
export function ModeSwitcher({ showPresentation = false }: { showPresentation?: boolean }) {
  const { mode, toggleMode, presentation, setPresentation } = useTheme();

  return (
    <div className="flex items-center gap-1">
      {showPresentation ? (
        <button
          type="button"
          onClick={() => setPresentation(!presentation)}
          aria-pressed={presentation}
          title="Presentation mode — enlarges KPIs and hides secondary controls"
          className={cn(
            "inline-flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-input border px-3 text-[12px] font-semibold transition-colors sm:min-h-0 sm:min-w-0 sm:px-2.5 sm:py-1.5 sm:text-[11.5px]",
            presentation
              ? "border-transparent bg-accent text-white"
              : "border-line bg-panel text-muted hover:text-ink",
          )}
        >
          <Monitor className="h-3.5 w-3.5" aria-hidden />
          <span className="hidden sm:inline">Presentation</span>
        </button>
      ) : null}
      <button
        type="button"
        onClick={toggleMode}
        aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        title={mode === "dark" ? "Light mode" : "Dark mode"}
        className="inline-flex h-10 w-10 items-center justify-center rounded-input border border-line bg-panel text-muted transition-colors hover:text-ink sm:h-8 sm:w-8"
      >
        {mode === "dark" ? (
          <Sun className="h-4 w-4" aria-hidden />
        ) : (
          <Moon className="h-4 w-4" aria-hidden />
        )}
      </button>
    </div>
  );
}
