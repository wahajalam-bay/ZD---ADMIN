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
    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      <label className="sr-only" htmlFor="reporting-week">
        Reporting week
      </label>
      {/* The week picker is the most-used control on a phone: full width and a
          40px target there, compact pill from `sm` up. */}
      <div className="flex min-h-10 w-full items-center gap-1.5 rounded-full border border-line bg-panel px-3 sm:min-h-0 sm:w-auto sm:px-2.5 sm:py-1">
        <CalendarRange className="h-4 w-4 shrink-0 text-muted sm:h-3.5 sm:w-3.5" aria-hidden />
        <select
          id="reporting-week"
          value={selected}
          onChange={(e) => update({ week: e.target.value })}
          className="min-h-9 w-full bg-transparent text-[13px] font-semibold text-ink outline-none sm:min-h-0 sm:w-auto sm:text-[12px]"
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
        <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-accent-deep px-3 py-1 text-[11.5px] font-bold text-white sm:min-h-0 sm:px-2.5 sm:text-[11px]">
          <Upload className="h-3 w-3" aria-hidden /> Published
        </span>
      )}

      {dataState === "NO_DATA" ? (
        <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-line bg-panel2 px-3 py-1 text-[11.5px] font-semibold text-muted sm:min-h-0 sm:px-2.5 sm:text-[11px]">
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
