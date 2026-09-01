"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarRange, Eye, Info, Upload } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { weekLabel, weekRangeLabel } from "@/lib/week";

export type WeekDataState = "PUBLISHED" | "PREVIEW" | "NO_DATA";

/**
 * One coherent reporting control cluster: reporting week + publication state.
 * Selection travels in the URL so server components re-query — weeks are never
 * mixed and Preview data can never be mistaken for official reporting.
 */
export function ReportingControls({
  weeks,
  selected,
  dataState,
  canPreview,
  previewOn,
}: {
  weeks: string[];
  selected: string;
  dataState: WeekDataState;
  canPreview: boolean;
  previewOn: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const update = React.useCallback(
    (params: Record<string, string | null>) => {
      const next = new URLSearchParams(search.toString());
      for (const [k, v] of Object.entries(params)) {
        if (v === null) next.delete(k);
        else next.set(k, v);
      }
      const qs = next.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, pathname, search],
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor="reporting-week">
        Reporting week
      </label>
      <div className="flex items-center gap-1.5 rounded-full border border-line bg-panel px-2.5 py-1">
        <CalendarRange className="h-3.5 w-3.5 text-muted" aria-hidden />
        <select
          id="reporting-week"
          value={selected}
          onChange={(e) => update({ week: e.target.value })}
          className="bg-transparent text-[12px] font-semibold text-ink outline-none"
        >
          {weeks.map((w) => (
            <option key={w} value={w}>
              {weekLabel(w)}
            </option>
          ))}
        </select>
      </div>

      {canPreview ? (
        <Segmented
          ariaLabel="Publication state"
          size="sm"
          value={previewOn ? "preview" : "published"}
          onChange={(v) => update({ preview: v === "preview" ? "1" : null })}
          options={[
            { value: "published", label: "Published", icon: Upload },
            { value: "preview", label: "Approved Preview", icon: Eye },
          ]}
        />
      ) : (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-deep px-2.5 py-1 text-[11px] font-bold text-white">
          <Upload className="h-3 w-3" aria-hidden /> Published
        </span>
      )}

      {dataState === "NO_DATA" ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel2 px-2.5 py-1 text-[11px] font-semibold text-muted">
          <Info className="h-3 w-3" aria-hidden /> No data this week
        </span>
      ) : null}
    </div>
  );
}

/** Warning strip shown while Approved Preview is active. */
export function PreviewNotice({ weekStart }: { weekStart: string }) {
  return (
    <div
      role="status"
      className="mb-4 flex items-start gap-2 rounded-tile border border-warn/35 bg-warn-bg px-3.5 py-2.5 text-[12px] text-warn"
    >
      <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>
        <b>Previewing approved but unpublished data</b> for {weekRangeLabel(weekStart)}. These figures
        are not official published reporting yet.
      </span>
    </div>
  );
}
