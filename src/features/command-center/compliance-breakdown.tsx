"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { SeverityBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import type { AttentionRow } from "./attention-feed";

/** Client-side shape of the server `CategoryCompliance` row. */
export interface CategoryComplianceView {
  categoryKey: string;
  categoryName: string;
  total: number;
  clean: number;
  flagged: number;
  pct: number | null;
}

export interface PropertyComplianceView {
  code: string;
  name: string;
  pct: number | null;
  clean: number;
  flagged: number;
  total: number;
}

function barTone(pct: number | null): string {
  if (pct === null) return "bg-line-strong";
  if (pct >= 90) return "bg-accent";
  if (pct >= 75) return "bg-warn";
  return "bg-bad";
}

function ComplianceBar({
  label,
  pct,
  flagged,
  total,
  onClick,
  active,
}: {
  label: string;
  pct: number | null;
  flagged: number;
  total: number;
  onClick?: () => void;
  active?: boolean;
}) {
  // Rendered with phrasing elements so the bar can also sit inside a <button>.
  const Comp = onClick ? "button" : "span";
  return (
    <Comp
      {...(onClick ? { type: "button" as const, onClick, "aria-pressed": active } : {})}
      className={cn(
        "block w-full rounded-tile px-2.5 py-2 text-start transition-colors",
        onClick && "hover:bg-panel2",
        active && "bg-panel2",
      )}
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[12.5px] font-semibold text-ink">{label}</span>
        <span className="shrink-0 font-mono text-[12.5px] font-bold text-ink">
          {pct === null ? "—" : `${pct}%`}
        </span>
      </span>
      <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-[var(--neutral-track)]">
        <span
          className={cn("block h-full rounded-full transition-[width] duration-500", barTone(pct))}
          style={{ width: `${pct ?? 0}%` }}
        />
      </span>
      <span className="mt-1 block text-[10.5px] text-muted">
        {total === 0
          ? "No published checklist points"
          : `${flagged} flagged of ${total} ${total === 1 ? "point" : "points"}`}
      </span>
    </Comp>
  );
}

/**
 * Compliance drill-down (§4 level 2–4): headline → per-property →
 * per-category → the individual flagged points behind the number. The
 * formula is stated so the figure is never a black box.
 */
export function ComplianceBreakdown({
  headline,
  clean,
  flagged,
  total,
  deltaPp,
  previousPct,
  categories,
  byProperty,
  issues,
}: {
  headline: number | null;
  clean: number;
  flagged: number;
  total: number;
  deltaPp: number | null;
  previousPct: number | null;
  categories: CategoryComplianceView[];
  byProperty: PropertyComplianceView[];
  issues: AttentionRow[];
}) {
  const [openCategory, setOpenCategory] = React.useState<string | null>(null);

  return (
    <div data-testid="compliance-breakdown">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[30px] leading-none font-bold text-ink">
          {headline === null ? "—" : `${headline}%`}
        </span>
        <span className="text-[12.5px] text-muted">checklist compliance</span>
      </div>
      <p className="mt-2 rounded-tile border border-line bg-panel2 px-3 py-2 text-[11.5px] leading-relaxed text-muted">
        {total === 0 ? (
          <>No published checklist points fall in this reporting week, so compliance is not measured.</>
        ) : (
          <>
            <b className="text-ink">{clean}</b> clean of <b className="text-ink">{total}</b> published
            checklist points ({flagged} flagged by a comment or severity).
            {deltaPp !== null && previousPct !== null ? (
              <>
                {" "}
                Last week was {previousPct}% — a change of{" "}
                <b className={deltaPp < 0 ? "text-warn" : "text-accent-dark"}>
                  {deltaPp > 0 ? "+" : ""}
                  {deltaPp} percentage {Math.abs(deltaPp) === 1 ? "point" : "points"}
                </b>
                .
              </>
            ) : (
              " No comparable previous week, so no change is shown."
            )}
          </>
        )}
      </p>

      {byProperty.length > 0 ? (
        <>
          <h3 className="t-label mt-5 mb-1.5 text-muted">By property</h3>
          <div className="divide-y divide-line overflow-hidden rounded-tile border border-line">
            {byProperty.map((p) => (
              <ComplianceBar
                key={p.code}
                label={p.name}
                pct={p.pct}
                flagged={p.flagged}
                total={p.total}
              />
            ))}
          </div>
        </>
      ) : null}

      <h3 className="t-label mt-5 mb-1.5 text-muted">By checklist category — worst first</h3>
      {categories.length === 0 ? (
        <p className="rounded-tile border border-dashed border-line px-3 py-4 text-center text-[12px] text-muted">
          No checklist categories were completed in this reporting week.
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-tile border border-line">
          {categories.map((c) => {
            const open = openCategory === c.categoryKey;
            const catIssues = issues.filter((i) => i.categoryName === c.categoryName);
            return (
              <li key={c.categoryKey}>
                <button
                  type="button"
                  data-testid={`compliance-category-${c.categoryKey}`}
                  onClick={() => setOpenCategory(open ? null : c.categoryKey)}
                  aria-expanded={open}
                  className="flex w-full items-center gap-2 px-1 text-start transition-colors hover:bg-panel2"
                >
                  <span className="min-w-0 flex-1">
                    <ComplianceBar
                      label={c.categoryName}
                      pct={c.pct}
                      flagged={c.flagged}
                      total={c.total}
                    />
                  </span>
                  <ChevronDown
                    className={cn(
                      "me-2 h-4 w-4 shrink-0 text-muted transition-transform duration-200",
                      open && "rotate-180",
                    )}
                    aria-hidden
                  />
                </button>
                {open ? (
                  <div className="border-t border-line bg-panel2 px-3 py-2.5">
                    {catIssues.length === 0 ? (
                      <p className="text-[11.5px] text-muted">
                        All {c.total} {c.total === 1 ? "point" : "points"} in {c.categoryName} were
                        recorded clean for the current selection.
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {catIssues.map((i) => (
                          <li key={i.responseId} className="flex items-start gap-2">
                            <SeverityBadge severity={i.severity} size="sm" />
                            <span className="min-w-0 flex-1">
                              <span className="block text-[12px] font-semibold text-ink">
                                {i.itemName}
                              </span>
                              <span className="block text-[11.5px] text-muted">
                                {i.propertyName} · {i.issue}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
