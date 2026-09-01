import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ClipboardList } from "lucide-react";
import { getSessionUser } from "@/server/auth/session";
import { canViewAllProperties } from "@/lib/roles";
import { listActiveProperties } from "@/server/services/metrics-service";
import { entryStatusForProperties } from "@/server/services/entry-home-service";
import { AccessDenied } from "@/components/shell/access-denied";
import { PageHeader } from "@/components/shell/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon, type IconName } from "@/components/ui/icon";
import { weekRangeLabel, currentWeekStart, todayStr } from "@/lib/week";
import type { WorkflowStatus } from "@/lib/roles";

export const metadata: Metadata = { title: "Data Entry" };
export const dynamic = "force-dynamic";

/**
 * Data Entry landing. Site users never see a property chooser — they are taken
 * straight to their site. Management gets operational status per property
 * (audit E1) rather than three empty cards.
 */
export default async function EntryLandingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const propertiesList = await listActiveProperties();

  if (!canViewAllProperties(user.role)) {
    const own = propertiesList.find((p) => p.id === user.propertyId);
    if (!own) {
      return (
        <AccessDenied message="Your account has no assigned property. Ask a Manager/Admin to assign one." />
      );
    }
    redirect(`/entry/${own.code}`);
  }

  const statuses = await entryStatusForProperties(propertiesList.map((p) => p.id));

  return (
    <div>
      <PageHeader
        eyebrow="Data Entry Engine"
        title="Site Operations"
        meta={
          <>
            {todayStr()} · reporting week {weekRangeLabel(currentWeekStart())} · management access
          </>
        }
      />

      {propertiesList.length === 0 ? (
        <EmptyState
          title="No active properties"
          detail="Add a property at Admin → Properties to start collecting site data."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {propertiesList.map((p) => {
            const s = statuses.get(p.id);
            const filed = s?.filedToday ?? 0;
            const total = s?.categoriesTotal ?? 0;
            const pct = total > 0 ? Math.round((filed / total) * 100) : 0;
            return (
              <Link
                key={p.id}
                href={`/entry/${p.code}`}
                data-testid={`entry-property-${p.code}`}
                className="group flex flex-col rounded-card border border-line bg-panel p-4 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-card-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-[15.5px] font-bold text-ink group-hover:text-accent-dark">
                      {p.name}
                    </h3>
                    <p className="mt-0.5 truncate text-[11px] text-muted">
                      {[p.location, p.propertyType].filter(Boolean).join(" · ") || "Master data pending"}
                    </p>
                  </div>
                  <StatusBadge status={(s?.weeklyStatus as WorkflowStatus | null) ?? null} size="sm" />
                </div>

                <div className="mt-3.5">
                  <div className="flex items-end justify-between">
                    <span className="t-label text-muted">Today&apos;s checklists</span>
                    <span className="font-mono text-[15px] font-bold text-ink">
                      {filed} / {total}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--neutral-track)]">
                    <div
                      className="h-full rounded-full bg-[var(--c1)] transition-[width] duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className="mt-3.5 grid grid-cols-3 gap-2 border-t border-line pt-3">
                  <MiniStat icon="draft" value={s?.draftToday ?? 0} label="Drafts" tone="orange" />
                  <MiniStat icon="inbox" value={s?.pendingReview ?? 0} label="Pending review" tone="blue" />
                  <MiniStat
                    icon="returned"
                    value={s?.returned ?? 0}
                    label="Returned"
                    tone={(s?.returned ?? 0) > 0 ? "red" : "muted"}
                  />
                </div>

                <span className="mt-3 inline-flex items-center gap-1 text-[11.5px] font-bold text-accent-dark">
                  Open property <ArrowRight className="h-3 w-3" aria-hidden />
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MiniStat({
  icon,
  value,
  label,
  tone,
}: {
  icon: IconName;
  value: number;
  label: string;
  tone: "orange" | "blue" | "red" | "muted";
}) {
  const color =
    tone === "orange"
      ? "text-warn"
      : tone === "blue"
        ? "text-info"
        : tone === "red"
          ? "text-bad"
          : "text-muted";
  return (
    <div className="min-w-0">
      <div className={`flex items-center gap-1 font-mono text-[15px] font-bold ${color}`}>
        <Icon name={icon} className="h-3 w-3 opacity-70" />
        {value}
      </div>
      <div className="t-label mt-0.5 truncate text-muted">{label}</div>
    </div>
  );
}

export { ClipboardList };
