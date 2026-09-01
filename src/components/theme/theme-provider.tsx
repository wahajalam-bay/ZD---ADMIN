"use client";

import * as React from "react";

export type ColorMode = "light" | "dark";

interface ThemeState {
  mode: ColorMode;
  presentation: boolean;
  setMode: (m: ColorMode) => void;
  toggleMode: () => void;
  setPresentation: (v: boolean) => void;
}

const STORAGE_KEY = "zameen.theme";

/**
 * The document element is the single source of truth for the active mode:
 * `ThemeScript` applies the stored classes before paint, and components read
 * them through `useSyncExternalStore` — no state sync effects, no flash.
 */
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): string {
  const el = document.documentElement;
  return `${el.classList.contains("dark") ? "dark" : "light"}|${el.classList.contains("presentation") ? "1" : "0"}`;
}

function getServerSnapshot(): string {
  return "light|0";
}

function persist() {
  try {
    const el = document.documentElement;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        mode: el.classList.contains("dark") ? "dark" : "light",
        presentation: el.classList.contains("presentation"),
      }),
    );
  } catch {
    // storage unavailable (private mode) — the session still works
  }
}

const ThemeContext = React.createContext<ThemeState | null>(null);

export function useTheme() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}

/** System-level modes (§7): Light / Dark token switch + Presentation. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const snapshot = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [modePart, presentationPart] = snapshot.split("|");
  const mode = (modePart === "dark" ? "dark" : "light") as ColorMode;
  const presentation = presentationPart === "1";

  const value = React.useMemo<ThemeState>(
    () => ({
      mode,
      presentation,
      setMode: (m) => {
        document.documentElement.classList.toggle("dark", m === "dark");
        persist();
        emit();
      },
      toggleMode: () => {
        document.documentElement.classList.toggle("dark");
        persist();
        emit();
      },
      setPresentation: (v) => {
        document.documentElement.classList.toggle("presentation", v);
        persist();
        emit();
      },
    }),
    [mode, presentation],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Blocking script: applies the stored mode before first paint. */
export function ThemeScript() {
  const js = `(function(){try{var s=JSON.parse(localStorage.getItem("${STORAGE_KEY}")||"{}");var d=s.mode?s.mode==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;if(d)document.documentElement.classList.add("dark");if(s.presentation)document.documentElement.classList.add("presentation");}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
