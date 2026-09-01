"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, RotateCcw, Search } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { StatusBadge } from "@/components/ui/status-badge";
import { Input } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { WorkflowStatus } from "@/lib/roles";

export interface BoardItem {
  key: string;
  name: string;
  type: "CHECK" | "LOG" | "EVAL";
  itemCount: number;
  status: WorkflowStatus | null;
}

type Filter = "ALL" | "PENDING" | "DRAFT" | "RETURNED" | "SUBMITTED" | "APPROVED";

/**
 * Checklist board (audit E3): search + status filters, returned items float to
 * the top so corrections are never missed, compact cards showing scale.
 */
export function ChecklistBoard({
  propertyCode,
  date,
  items,
  initialFilter,
}: {
  propertyCode: string;
  date: string;
  items: BoardItem[];
  initialFilter: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>(
    (["ALL", "PENDING", "DRAFT", "RETURNED", "SUBMITTED", "APPROVED"] as const).includes(
      initialFilter as Filter,
    )
      ? (initialFilter as Filter)
      : "ALL",
  );

  const counts = React.useMemo(
    () => ({
      ALL: items.length,
      PENDING: items.filter((i) => i.status === null).length,
      DRAFT: items.filter((i) => i.status === "DRAFT").length,
      RETURNED: items.filter((i) => i.status === "RETURNED").length,
      SUBMITTED: items.filter((i) => i.status === "SUBMITTED").length,
      APPROVED: items.filter((i) => i.status === "APPROVED" || i.status === "PUBLISHED").length,
    }),
    [items],
  );

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const rank = (s: WorkflowStatus | null) =>
      s === "RETURNED" ? 0 : s === null ? 1 : s === "DRAFT" ? 2 : 3;
    return items
      .filter((i) => (q ? i.name.toLowerCase().includes(q) : true))
      .filter((i) => {
        switch (filter) {
          case "PENDING":
            return i.status === null;
          case "DRAFT":
            return i.status === "DRAFT";
          case "RETURNED":
            return i.status === "RETURNED";
          case "SUBMITTED":
            return i.status === "SUBMITTED";
          case "APPROVED":
            return i.status === "APPROVED" || i.status === "PUBLISHED";
          default:
            return true;
        }
      })
      .sort((a, b) => rank(a.status) - rank(b.status));
  }, [items, query, filter]);

  function setDate(next: string) {
    const params = new URLSearchParams(search.toString());
    params.set("date", next);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[190px] flex-1 sm:max-w-[280px]">
          <Search
            className="pointer-events-none absolute inset-y-0 start-2.5 my-auto h-3.5 w-3.5 text-muted"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search checklists…"
            aria-label="Search checklist categories"
            className="ps-8"
          />
        </div>
        <div className="flex items-center gap-1.5 rounded-input border border-line bg-panel px-2.5 py-1.5">
          <CalendarDays className="h-3.5 w-3.5 text-muted" aria-hidden />
          <label className="sr-only" htmlFor="board-date">
            Checklist date
          </label>
          <input
            id="board-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-transparent font-mono text-[12px] text-ink outline-none"
          />
        </div>
        <div className="w-full overflow-x-auto sm:w-auto">
          <Segmented
            ariaLabel="Filter by status"
            size="sm"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "ALL", label: "All", count: counts.ALL },
              { value: "PENDING", label: "Not started", count: counts.PENDING },
              { value: "DRAFT", label: "Draft", count: counts.DRAFT },
              ...(counts.RETURNED > 0
                ? [{ value: "RETURNED" as const, label: "Returned", count: counts.RETURNED, icon: RotateCcw }]
                : []),
              { value: "SUBMITTED", label: "Submitted", count: counts.SUBMITTED },
              { value: "APPROVED", label: "Approved", count: counts.APPROVED },
            ]}
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="No checklist categories match this filter"
          detail="Clear the search or choose a different status to see the rest of the day's checklists."
        />
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((item) => (
            <Link
              key={item.key}
              href={`/entry/${propertyCode}/checklists/${item.key}?date=${date}`}
              data-testid={`category-${item.key}`}
              className={cn(
                "group flex flex-col gap-2 rounded-card border bg-panel px-3.5 py-3 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-2",
                item.status === "RETURNED"
                  ? "border-bad/45 hover:border-bad"
                  : "border-line hover:border-line-strong",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-[13px] leading-snug font-bold text-ink group-hover:text-accent-dark">
                  {item.name}
                </span>
                <span className="t-label shrink-0 rounded bg-panel2 px-1.5 py-0.5 text-muted">
                  {item.type}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted">
                  {item.type === "LOG" ? "Log fields" : `${item.itemCount} items`}
                </span>
                <StatusBadge status={item.status} size="sm" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
