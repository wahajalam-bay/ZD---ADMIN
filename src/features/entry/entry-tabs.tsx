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
    // Full width on phones so each tab is a comfortable target; inline on desktop.
    <nav
      aria-label="Entry sections"
      className="flex w-full gap-1 rounded-lg border border-line bg-panel p-1 sm:w-auto"
    >
      {tabs.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-10 flex-1 items-center justify-center rounded-md px-3 text-[12.5px] font-bold sm:min-h-0 sm:flex-none sm:px-3.5 sm:py-1.5",
              active
                ? "bg-[image:var(--grad-green)] text-white shadow-[0_3px_10px_-2px_rgba(13,122,63,0.5)]"
                : "text-muted hover:bg-panel2",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
