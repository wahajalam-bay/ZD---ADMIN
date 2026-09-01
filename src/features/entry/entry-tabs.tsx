"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function EntryTabs({ propertyCode }: { propertyCode: string }) {
  const pathname = usePathname();
  const base = `/entry/${propertyCode}`;
  const tabs = [
    { label: "Overview", href: base, exact: true },
    { label: "Weekly Report", href: `${base}/weekly`, exact: false },
    { label: "Daily Checklists", href: `${base}/checklists`, exact: false },
  ];
  return (
    <nav aria-label="Entry sections" className="flex gap-1 rounded-lg border border-line bg-panel p-1">
      {tabs.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3.5 py-1.5 text-[12.5px] font-bold",
              active ? "bg-accent text-white" : "text-muted hover:bg-slate-50",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
