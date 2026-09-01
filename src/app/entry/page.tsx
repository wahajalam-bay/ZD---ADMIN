import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";
import { canViewAllProperties } from "@/lib/roles";
import { listActiveProperties } from "@/server/services/metrics-service";
import { AccessDenied } from "@/components/shell/access-denied";
import { weekRangeLabel, currentWeekStart } from "@/lib/week";

export const metadata: Metadata = { title: "Data Entry" };
export const dynamic = "force-dynamic";

/**
 * Entry landing. Site users are taken straight to their assigned property —
 * they are never shown a property chooser. Management picks a property.
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

  return (
    <div>
      <div className="mb-1 text-[11.5px] font-semibold tracking-wider text-muted uppercase">
        Data Entry Engine
      </div>
      <h2 className="text-[22px] font-bold">Choose a property</h2>
      <p className="mt-1 text-[13px] text-muted">
        Reporting week {weekRangeLabel(currentWeekStart())} · management access — all properties
      </p>
      <div className="mt-5 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {propertiesList.map((p) => (
          <Link
            key={p.id}
            href={`/entry/${p.code}`}
            className="rounded-card border border-line bg-panel px-5 py-4 shadow-card transition hover:-translate-y-0.5 hover:border-accent hover:shadow-md"
          >
            <h3 className="text-[16px] font-bold">{p.name}</h3>
            <div className="mt-1 text-xs text-muted">
              {[p.location, p.propertyType].filter(Boolean).join(" · ") || "Master data pending"}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
