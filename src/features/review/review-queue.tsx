"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowRight, Camera, Clock, Search } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { StatusBadge } from "@/components/ui/status-badge";
import { Input, Label, Select } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import type { WorkflowStatus } from "@/lib/roles";
import { cn } from "@/lib/utils";

export interface QueueItem {
  kind: "checklist" | "weekly";
  id: string;
  propertyName: string;
  title: string;
  dateLabel: string;
  status: WorkflowStatus;
  submittedByName: string | null;
  submittedAt: string | null;
  issueCount: number;
  evidenceCount: number;
}

/**
 * Exception-first review queue (audit V1/V3): status counts double as filters,
 * one primary action per row, issues and evidence surfaced up front.
 */
export function ReviewQueue({
  items,
  counts,
  properties,
  categories,
  total,
}: {
  items: QueueItem[];
  counts: Record<WorkflowStatus, number>;
  properties: Array<{ code: string; name: string }>;
  categories: Array<{ key: string; name: string }>;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [query, setQuery] = React.useState("");

  const status = (search.get("status") as WorkflowStatus | null) ?? "SUBMITTED";

  const set = React.useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(search.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete("page");
      router.push(`${pathname}?${next.toString()}`);
    },
    [router, pathname, search],
  );

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.propertyName.toLowerCase().includes(q) ||
        i.title.toLowerCase().includes(q) ||
        (i.submittedByName ?? "").toLowerCase().includes(q),
    );
  }, [items, query]);

  return (
    <div>
      <div className="mb-3 overflow-x-auto">
        <Segmented
          ariaLabel="Queue status"
          value={status}
          onChange={(v) => set("status", v)}
          options={[
            { value: "SUBMITTED", label: "Pending", count: counts.SUBMITTED, icon: Clock },
            { value: "RETURNED", label: "Returned", count: counts.RETURNED },
            { value: "APPROVED", label: "Approved", count: counts.APPROVED },
            { value: "PUBLISHED", label: "Published", count: counts.PUBLISHED },
          ]}
        />
      </div>

      <Card className="mb-4 grid grid-cols-2 gap-3 p-3.5 sm:grid-cols-3 lg:grid-cols-5">
        <div className="col-span-2 sm:col-span-1">
          <Label htmlFor="q-search">Search</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute inset-y-0 start-2.5 my-auto h-3.5 w-3.5 text-muted"
              aria-hidden
            />
            <Input
              id="q-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Property, checklist, submitter…"
              className="ps-8"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="q-property">Property</Label>
          <Select id="q-property" value={search.get("property") ?? ""} onChange={(e) => set("property", e.target.value)}>
            <option value="">All</option>
            {properties.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="q-type">Type</Label>
          <Select id="q-type" value={search.get("type") ?? ""} onChange={(e) => set("type", e.target.value)}>
            <option value="">All</option>
            <option value="checklist">Checklist</option>
            <option value="weekly">Weekly report</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="q-category">Checklist</Label>
          <Select id="q-category" value={search.get("category") ?? ""} onChange={(e) => set("category", e.target.value)}>
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="q-week">Week of</Label>
          <Input
            id="q-week"
            type="date"
            value={search.get("week") ?? ""}
            onChange={(e) => set("week", e.target.value)}
            className="font-mono text-[11.5px]"
          />
        </div>
      </Card>

      {visible.length === 0 ? (
        <EmptyState
          title={
            status === "SUBMITTED"
              ? "Nothing is currently waiting for review"
              : "No submissions match these filters"
          }
          detail="Site submissions appear here the moment they are sent for review."
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {visible.map((item) => (
            <Link
              key={`${item.kind}-${item.id}`}
              href={`/review/${item.kind}/${item.id}`}
              data-testid={`queue-row-${item.id}`}
              className="group flex flex-wrap items-center gap-3 rounded-card border border-line bg-panel px-4 py-3 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-card-2"
            >
              <div className="min-w-[150px]">
                <div className="text-[13.5px] font-bold text-ink group-hover:text-accent-dark">
                  {item.propertyName}
                </div>
                <div className="text-[11.5px] text-muted">{item.title}</div>
              </div>
              <div className="min-w-[110px] font-mono text-[11.5px] text-muted">{item.dateLabel}</div>
              <div className="min-w-[140px] text-[11.5px] text-muted">
                {item.submittedByName ?? "—"}
                <span className="block font-mono text-[10.5px]">
                  {item.submittedAt ? formatDateTime(item.submittedAt) : "—"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {item.issueCount > 0 ? (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold",
                      item.kind === "checklist" ? "bg-bad-bg text-bad" : "bg-panel2 text-muted",
                    )}
                  >
                    <AlertTriangle className="h-3 w-3" aria-hidden />
                    {item.issueCount} {item.kind === "checklist" ? "issues" : "tasks"}
                  </span>
                ) : null}
                {item.evidenceCount > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-panel2 px-2 py-0.5 text-[11px] font-bold text-muted">
                    <Camera className="h-3 w-3" aria-hidden />
                    {item.evidenceCount}
                  </span>
                ) : null}
              </div>
              <StatusBadge status={item.status} size="sm" />
              <span className="ms-auto inline-flex items-center gap-1 rounded-input bg-[var(--grad-green)] px-3 py-1.5 text-[11.5px] font-bold text-white">
                Review <ArrowRight className="h-3 w-3" aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      )}

      {total > visible.length ? (
        <p className="mt-3 text-center text-[11.5px] text-muted">
          Showing {visible.length} of {total} — refine the filters to narrow the queue.
        </p>
      ) : null}
    </div>
  );
}
