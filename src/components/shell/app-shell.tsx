import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";
import { listActiveProperties, propertyWeekStats, PUBLISHED_ONLY } from "@/server/services/metrics-service";
import { countPendingReview } from "@/server/services/review-service";
import { latestPublishedWeek } from "@/server/services/reporting-week-service";
import { canAdministerUsers, canReview, canViewAllProperties, ROLE_LABELS } from "@/lib/roles";
import { ShellClient, type NavSection } from "./shell-client";

/**
 * Application shell (server). Navigation is built from database properties and
 * the signed-in user's role; property rows carry their live weekly tracking
 * status so the sidebar dots mean something (not decorative brand colours).
 */
export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const properties = await listActiveProperties();
  const sections: NavSection[] = [];
  const management = canViewAllProperties(user.role);

  if (management) {
    const week = await latestPublishedWeek();
    const stats = await propertyWeekStats(week, PUBLISHED_ONLY);

    sections.push({
      label: "Dashboards",
      items: [
        { label: "Portfolio Overview", href: "/command-center", icon: "overview" },
        { label: "Progress Photos", href: "/command-center/photos", icon: "photos" },
      ],
    });
    sections.push({
      label: "Properties",
      items: properties.map((p) => ({
        label: p.name,
        href: `/command-center/${p.code}`,
        tracking: stats.get(p.id)?.trackingStatus ?? null,
      })),
    });

    const pending = canReview(user.role) ? await countPendingReview() : 0;
    sections.push({
      label: "Operations",
      items: [
        { label: "Data Entry", href: "/entry", icon: "entry" },
        { label: "Review Queue", href: "/review", icon: "review", badge: pending || undefined },
      ],
    });

    if (canAdministerUsers(user.role)) {
      sections.push({
        label: "Administration",
        items: [
          { label: "Users", href: "/admin/users", icon: "users" },
          { label: "Properties", href: "/admin/properties", icon: "properties" },
          { label: "Integrations", href: "/admin/integrations", icon: "integrations" },
          { label: "Audit Log", href: "/admin/audit", icon: "audit" },
        ],
      });
    }
  } else {
    const own = properties.find((p) => p.id === user.propertyId);
    sections.push({
      label: own ? own.name : "Data Entry",
      items: own
        ? [
            { label: "My Site", href: `/entry/${own.code}`, icon: "overview" },
            { label: "Daily Checklists", href: `/entry/${own.code}/checklists`, icon: "checklists" },
            { label: "Weekly Report", href: `/entry/${own.code}/weekly`, icon: "weekly" },
          ]
        : [{ label: "Data Entry", href: "/entry", icon: "entry" }],
    });
  }

  return (
    <ShellClient
      sections={sections}
      demoEnvironment={process.env.APP_ENV === "demo"}
      user={{ name: user.name, email: user.email, roleLabel: ROLE_LABELS[user.role] }}
    >
      {children}
    </ShellClient>
  );
}
