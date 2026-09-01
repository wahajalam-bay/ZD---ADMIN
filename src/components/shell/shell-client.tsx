"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

export interface NavItem {
  label: string;
  href: string;
  badge?: number;
  dot?: string | null;
  meta?: string | null;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

const DOT_COLORS: Record<string, string> = {
  green: "bg-accent",
  orange: "bg-amber",
  blue: "bg-info",
  grey: "bg-slate-400",
};

function SidebarNav({ sections, onNavigate }: { sections: NavSection[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main navigation" className="flex-1 overflow-y-auto pb-6">
      {sections.map((section) => (
        <div key={section.label}>
          <div className="px-5 pt-4 pb-1.5 text-[10.5px] font-bold tracking-[0.08em] text-muted uppercase">
            {section.label}
          </div>
          {section.items.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/" && item.href.split("/").length > 2 && pathname.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 border-l-[3px] px-5 py-2 text-[13.5px] text-ink transition-colors",
                  active
                    ? "border-accent bg-accent-light font-bold text-accent-dark"
                    : "border-transparent hover:bg-accent-light/60",
                )}
              >
                {item.dot ? (
                  <span
                    aria-hidden
                    className={cn("h-2 w-2 shrink-0 rounded-full", DOT_COLORS[item.dot] ?? "bg-slate-300")}
                  />
                ) : null}
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge ? (
                  <span className="rounded-full bg-bad px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                    {item.badge}
                  </span>
                ) : null}
                {item.meta ? (
                  <span className="font-mono text-[10px] font-semibold text-muted">{item.meta}</span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function ShellClient({
  sections,
  user,
  children,
}: {
  sections: NavSection[];
  user: { name: string; email: string; roleLabel: string };
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const router = useRouter();

  async function signOut() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  const brand = (
    <div className="bg-grad-header mx-3 mb-3 flex items-center gap-3 rounded-[14px] px-3.5 py-3 shadow-card-2">
      <span
        aria-hidden
        className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-gradient-to-br from-white to-[#d8f0e2] text-[13px] font-bold text-accent-deep shadow-[0_4px_12px_rgba(0,0,0,0.25),inset_0_0_0_1px_rgba(255,255,255,0.6)]"
      >
        ZA
      </span>
      <div className="min-w-0">
        <h1 className="truncate text-[13.5px] leading-tight font-bold tracking-[0.2px] text-white">
          Zameen Developments
        </h1>
        <div className="text-[9.5px] font-semibold tracking-[0.6px] text-white/70 uppercase">
          Admin Properties · Command Center
        </div>
      </div>
    </div>
  );

  const userBlock = (
    <div className="border-t border-line px-5 py-3">
      <div className="truncate text-[13px] font-bold">{user.name}</div>
      <div className="truncate text-[11px] text-muted">{user.roleLabel}</div>
      <button
        onClick={signOut}
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-panel2"
      >
        <LogOut className="h-3.5 w-3.5" aria-hidden />
        Sign out
      </button>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[250px] flex-col border-r border-line bg-panel pt-5 lg:flex">
        {brand}
        <SidebarNav sections={sections} />
        {userBlock}
      </aside>

      {/* Mobile top bar + drawer */}
      <div className="bg-grad-header fixed inset-x-0 top-0 z-40 flex items-center justify-between px-4 py-2.5 shadow-card-2 lg:hidden">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-white to-[#d8f0e2] text-[11px] font-bold text-accent-deep"
          >
            ZA
          </span>
          <div>
            <div className="text-[12.5px] leading-tight font-bold text-white">Zameen Developments</div>
            <div className="text-[9px] font-semibold tracking-[0.6px] text-white/70 uppercase">
              Admin Properties
            </div>
          </div>
        </div>
        <button
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-[10px] border border-white/25 bg-white/12 p-2 text-white"
        >
          {mobileOpen ? <X className="h-4 w-4" aria-hidden /> : <Menu className="h-4 w-4" aria-hidden />}
        </button>
      </div>
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-950/40"
            aria-hidden
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[270px] flex-col bg-panel pt-5 shadow-2xl">
            {brand}
            <SidebarNav sections={sections} onNavigate={() => setMobileOpen(false)} />
            {userBlock}
          </aside>
        </div>
      ) : null}

      <main className="w-full flex-1 px-4 pt-16 pb-16 sm:px-6 lg:ml-[250px] lg:px-8 lg:pt-7">
        <div className="mx-auto max-w-[1180px]">{children}</div>
      </main>
    </div>
  );
}
