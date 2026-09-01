"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select, Label, Input } from "@/components/ui/field";

/** Filter bar for the review queue; state lives in the URL. */
export function ReviewFilters({
  properties,
  categories,
}: {
  properties: Array<{ code: string; name: string }>;
  categories: Array<{ key: string; name: string }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  function set(key: string, value: string) {
    const next = new URLSearchParams(search.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="grid grid-cols-2 gap-3 rounded-card border border-line bg-panel p-4 shadow-card sm:grid-cols-3 lg:grid-cols-5">
      <div>
        <Label htmlFor="f-property">Property</Label>
        <Select id="f-property" value={search.get("property") ?? ""} onChange={(e) => set("property", e.target.value)}>
          <option value="">All</option>
          {properties.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="f-type">Type</Label>
        <Select id="f-type" value={search.get("type") ?? ""} onChange={(e) => set("type", e.target.value)}>
          <option value="">All</option>
          <option value="checklist">Checklist</option>
          <option value="weekly">Weekly report</option>
        </Select>
      </div>
      <div>
        <Label htmlFor="f-status">Status</Label>
        <Select id="f-status" value={search.get("status") ?? ""} onChange={(e) => set("status", e.target.value)}>
          <option value="">Submitted (default)</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="RETURNED">Returned</option>
          <option value="APPROVED">Approved</option>
          <option value="PUBLISHED">Published</option>
        </Select>
      </div>
      <div>
        <Label htmlFor="f-category">Category</Label>
        <Select id="f-category" value={search.get("category") ?? ""} onChange={(e) => set("category", e.target.value)}>
          <option value="">All</option>
          {categories.map((c) => (
            <option key={c.key} value={c.key}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="f-week">Week of</Label>
        <Input
          id="f-week"
          type="date"
          value={search.get("week") ?? ""}
          onChange={(e) => set("week", e.target.value)}
          className="font-mono text-[16px] sm:text-xs"
        />
      </div>
    </div>
  );
}
