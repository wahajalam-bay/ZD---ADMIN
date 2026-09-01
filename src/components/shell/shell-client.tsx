"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  ClipboardList,
  Images,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  PlugZap,
  ScrollText,
  Settings2,
  ShieldCheck,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { ActionMenu } from "@/components/ui/menu";
import { TrackingDot, type Tracking } from "@/components/ui/status-badge";

export interface NavItem {
  label: string;
  href: string;
  badge?: number;
  /** Live weekly tracking status for property rows (null = no report). */
  tracking?: Tracking | null;
  icon?: string;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  overview: LayoutDashboard,
  photos: Images,
  entry: ClipboardList,
  review: ListChecks,
  users: Users,
  properties: Building2,
  integrations: PlugZap,
  audit: ScrollText,
  weekly: ScrollText,
  checklists: ListChecks,
};

function SidebarNav({
  sections,
  onNavigate,
}: {
  sections: NavSection[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-2.5 pb-4">
      {sections.map((section) => (
        <div key={section.label} className="mb-1">
          <div className="t-label px-2.5 pt-4 pb-1.5 text-muted/80">{section.label}</div>
          {section.items.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/" &&
                item.href.split("/").length > 2 &&
                pathname.startsWith(`${item.href}/`));
            const Icon = item.icon ? ICONS[item.icon] : undefined;
            const isProperty = item.tracking !== undefined;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative mb-0.5 flex items-center gap-2.5 rounded-input px-2.5 py-[7px] text-[12.8px] transition-colors",
                  active
                    ? "bg-accent-light font-bold text-accent-dark"
                    : "text-ink/85 hover:bg-panel2",
                )}
              >
                {active ? (
                  <span
                    aria-hidden
                    className="absolute inset-y-1.5 start-0 w-[3px] rounded-full bg-accent"
                  />
                ) : null}
                {isProperty ? (
                  <TrackingDot status={item.tracking ?? null} />
                ) : Icon ? (
                  <Icon
                    className={cn("h-4 w-4 shrink-0", active ? "text-accent-dark" : "text-muted")}
                    aria-hidden
                  />
                ) : null}
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge ? (
                  <span className="rounded-full bg-bad px-1.5 py-px font-mono text-[10px] font-bold text-white">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function BrandPanel() {
  return (
    <div className="mx-2.5 mb-1 flex items-center gap-2.5 rounded-[14px] bg-[var(--grad-header)] px-3 py-2.5 shadow-card-2">
      <span
        aria-hidden
        className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-gradient-to-br from-white to-[#d8f0e2] text-[12px] font-extrabold text-accent-deep shadow-[0_4px_12px_rgba(0,0,0,0.25),inset_0_0_0_1px_rgba(255,255,255,0.6)]"
      >
        ZA
      </span>
      <div className="min-w-0 leading-tight">
        <div className="text-[11.5px] font-extrabold tracking-[0.4px] text-white">
          ZAMEEN DEVELOPMENTS
        </div>
        <div className="text-[9.5px] font-semibold tracking-[0.4px] text-white/70">
          Admin Properties · Command Center
        </div>
      </div>
    </div>
  );
}

function UserPanel({
  user,
  onSignOut,
}: {
  user: { name: string; email: string; roleLabel: string };
  onSignOut: () => void;
}) {
  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div className="mx-2.5 mb-2.5 flex items-center gap-2.5 rounded-tile border border-line bg-panel2 px-2.5 py-2">
      <span
        aria-hidden
        className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-[var(--grad-green)] text-[11px] font-bold text-white"
      >
        {initials || "U"}
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate text-[12px] font-bold text-ink">{user.name}</div>
        <div className="truncate text-[10.5px] text-muted">{user.roleLabel}</div>
      </div>
      <ActionMenu
        label="Account menu"
        items={[
          { label: user.email, icon: UserCircle, onSelect: () => undefined },
          { label: "Sign out", icon: LogOut, onSelect: onSignOut, danger: true },
        ]}
      />
    </div>
  );
}

export function ShellClient({
  sections,
  user,
  demoEnvironment,
  children,
}: {
  sections: NavSection[];
  user: { name: string; email: string; roleLabel: string };
  demoEnvironment?: boolean;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const router = useRouter();

  async function signOut() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  const sidebarBody = (onNavigate?: () => void) => (
    <>
      <BrandPanel />
      {demoEnvironment ? (
        <div className="mx-2.5 mt-1.5 flex items-center gap-1.5 rounded-input border border-warn/30 bg-warn-bg px-2.5 py-1 text-[10px] font-bold text-warn">
          <ShieldCheck className="h-3 w-3" aria-hidden />
          DEMO DATA ENVIRONMENT
        </div>
      ) : null}
      <SidebarNav sections={sections} onNavigate={onNavigate} />
      <UserPanel user={user} onSignOut={signOut} />
    </>
  );

  return (
    <div className="relative z-10 flex min-h-screen">
      <a href="#main" className="sr-only sr-only-focusable">
        Skip to content
      </a>

      {/* Desktop sidebar — 236px (kit range 230–245) */}
      <aside className="fixed inset-y-0 start-0 z-40 hidden w-[236px] flex-col border-e border-line bg-panel pt-3 lg:flex">
        {sidebarBody()}
      </aside>

      {/* Mobile bar + drawer */}
      <div className="fixed inset-x-0 top-0 z-40 flex items-center justify-between bg-[var(--grad-header)] px-4 py-2.5 shadow-card-2 lg:hidden">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="grid h-8 w-8 place-items-center rounded-[9px] bg-gradient-to-br from-white to-[#d8f0e2] text-[11px] font-extrabold text-accent-deep"
          >
            ZA
          </span>
          <div className="leading-tight">
            <div className="text-[11.5px] font-extrabold tracking-[0.4px] text-white">
              ZAMEEN DEVELOPMENTS
            </div>
            <div className="text-[9px] font-semibold tracking-[0.4px] text-white/70">
              Admin Properties
            </div>
          </div>
        </div>
        <button
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-input border border-white/25 bg-white/10 p-2 text-white"
        >
          {mobileOpen ? <X className="h-4 w-4" aria-hidden /> : <Menu className="h-4 w-4" aria-hidden />}
        </button>
      </div>
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="anim-fade absolute inset-0 bg-[rgba(6,61,36,0.45)]"
            aria-hidden
            onClick={() => setMobileOpen(false)}
          />
          <aside className="anim-panel absolute inset-y-0 start-0 flex w-[264px] flex-col bg-panel pt-3 shadow-panel">
            {sidebarBody(() => setMobileOpen(false))}
          </aside>
        </div>
      ) : null}

      <main
        id="main"
        className="w-full flex-1 px-4 pt-16 pb-14 sm:px-6 lg:ms-[236px] lg:px-8 lg:pt-5"
      >
        <div className="mx-auto w-full" style={{ maxWidth: "var(--canvas-max)" }}>
          {children}
        </div>
      </main>
    </div>
  );
}

export { Settings2 };
