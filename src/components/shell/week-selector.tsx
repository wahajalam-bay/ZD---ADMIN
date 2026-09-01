"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { weekLabel } from "@/lib/week";
import { Badge } from "@/components/ui/badge";

/**
 * Reporting-week selector. Weeks come from the database (published/known
 * weeks); the selection travels via the ?week= query param so server
 * components re-query for the chosen period. Weeks are never mixed.
 */
export function WeekSelector({
  weeks,
  selected,
  dataState,
  canPreview,
  previewOn,
}: {
  weeks: string[];
  selected: string;
  dataState: "PUBLISHED" | "PREVIEW" | "NO_DATA";
  canPreview: boolean;
  previewOn: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  function update(params: Record<string, string | null>) {
    const next = new URLSearchParams(search.toString());
    for (const [k, v] of Object.entries(params)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    router.push(`${pathname}?${next.toString()}`);
  }

  const stateBadge =
    dataState === "PUBLISHED" ? (
      <Badge className="bg-ink text-white">Published</Badge>
    ) : dataState === "PREVIEW" ? (
      <Badge className="bg-warn-bg text-warn">Approved · Preview</Badge>
    ) : (
      <Badge className="bg-slate-100 text-muted">No data</Badge>
    );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="week-selector" className="sr-only">
        Reporting week
      </label>
      <select
        id="week-selector"
        value={selected}
        onChange={(e) => update({ week: e.target.value })}
        className="rounded-full border border-line bg-panel px-3 py-1.5 text-[12px] font-semibold text-ink"
      >
        {weeks.map((w) => (
          <option key={w} value={w}>
            {weekLabel(w)}
          </option>
        ))}
      </select>
      {stateBadge}
      {canPreview ? (
        <button
          onClick={() => update({ preview: previewOn ? null : "1" })}
          className={
            previewOn
              ? "rounded-full border border-warn bg-warn-bg px-3 py-1.5 text-[12px] font-bold text-warn"
              : "rounded-full border border-line bg-panel px-3 py-1.5 text-[12px] font-semibold text-muted hover:bg-slate-50"
          }
          title="Preview includes approved data that has not been published yet"
        >
          {previewOn ? "Previewing approved data" : "Preview approved"}
        </button>
      ) : null}
    </div>
  );
}
