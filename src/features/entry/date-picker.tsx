"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Label } from "@/components/ui/field";

/** Date selector that syncs to the ?date= query param. */
export function DatePicker({ date }: { date: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="entry-date" className="mb-0">
        Date
      </Label>
      <input
        id="entry-date"
        type="date"
        value={date}
        onChange={(e) => {
          const next = new URLSearchParams(search.toString());
          next.set("date", e.target.value);
          router.push(`${pathname}?${next.toString()}`);
        }}
        className="rounded-lg border border-line bg-panel px-2.5 py-1.5 font-mono text-[13px]"
      />
    </div>
  );
}
