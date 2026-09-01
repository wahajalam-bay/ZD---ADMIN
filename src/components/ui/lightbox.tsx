"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export interface LightboxItem {
  src: string;
  title: string;
  subtitle?: string;
}

/**
 * Full-screen image lightbox with previous/next + keyboard navigation
 * (←, →, Escape), preserved from the reference Command Center behavior.
 */
export function Lightbox({
  items,
  index,
  onClose,
  onNavigate,
}: {
  items: LightboxItem[];
  index: number;
  onClose: () => void;
  onNavigate: (nextIndex: number) => void;
}) {
  const item = items[index];
  const prev = React.useCallback(
    () => onNavigate((index - 1 + items.length) % items.length),
    [index, items.length, onNavigate],
  );
  const next = React.useCallback(
    () => onNavigate((index + 1) % items.length),
    [index, items.length, onNavigate],
  );

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, prev, next]);

  if (!item) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
      className="fixed inset-0 z-[999] flex flex-col items-center justify-center gap-4 bg-[rgba(10,14,14,0.92)] p-5"
      onClick={onClose}
    >
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute top-4 right-5 flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white hover:bg-white/25"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
      <div
        className="relative flex max-h-[70vh] max-w-[90vw] items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {items.length > 1 ? (
          <button
            aria-label="Previous photo"
            onClick={prev}
            className="absolute -left-14 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white hover:bg-white/25 md:flex"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
        ) : null}
        { }
        <img
          src={item.src}
          alt={item.title}
          className="max-h-[70vh] max-w-[90vw] rounded-md object-contain shadow-2xl"
        />
        {items.length > 1 ? (
          <button
            aria-label="Next photo"
            onClick={next}
            className="absolute -right-14 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white hover:bg-white/25 md:flex"
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        ) : null}
      </div>
      <div className="max-w-[86vw] text-center text-white" onClick={(e) => e.stopPropagation()}>
        <p className="text-[15px] font-bold">{item.title}</p>
        {item.subtitle ? (
          <p className="mt-1 font-mono text-xs text-slate-300">
            {item.subtitle} · photo {index + 1} of {items.length}
          </p>
        ) : null}
        {items.length > 1 ? (
          <div className="mt-3 flex justify-center gap-2 md:hidden">
            <button
              aria-label="Previous photo"
              onClick={prev}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <button
              aria-label="Next photo"
              onClick={next}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white"
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
