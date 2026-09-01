import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";
import { listActiveProperties } from "@/server/services/metrics-service";
import { countPendingReview } from "@/server/services/review-service";
import {
  canAdministerUsers,
  canReview,
  canViewAllProperties,
  ROLE_LABELS,
} from "@/lib/roles";
import { ShellClient, type NavSection } from "./shell-client";

/**
 * Application shell (server component). Navigation is built from the DATABASE
 * property list and the signed-in user's role — nothing property-specific is
 * hard-coded.
 */
export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const properties = await listActiveProperties();
  const sections: NavSection[] = [];

  if (canViewAllProperties(user.role)) {
    sections.push({
      label: "Dashboards",
      items: [
        { label: "Portfolio Overview", href: "/command-center" },
        { label: "Progress Photos", href: "/command-center/photos" },
      ],
    });
    sections.push({
      label: "Properties",
      items: properties.map((p) => ({
        label: p.name,
        href: `/command-center/${p.code}`,
        dot: p.statusIndicator,
        meta: p.phaseCode,
      })),
    });
    const pending = canReview(user.role) ? await countPendingReview() : 0;
    sections.push({
      label: "Operations",
      items: [
        { label: "Data Entry", href: "/entry" },
        { label: "Review Queue", href: "/review", badge: pending || undefined },
      ],
    });
    if (canAdministerUsers(user.role)) {
      sections.push({
        label: "Administration",
        items: [
          { label: "Users", href: "/admin/users" },
          { label: "Properties", href: "/admin/properties" },
          { label: "Integrations", href: "/admin/integrations" },
          { label: "Audit Log", href: "/admin/audit" },
        ],
      });
    }
  } else {
    const own = properties.find((p) => p.id === user.propertyId);
    sections.push({
      label: "Data Entry",
      items: own
        ? [
            { label: "Overview", href: `/entry/${own.code}` },
            { label: "Weekly Report", href: `/entry/${own.code}/weekly` },
            { label: "Daily Checklists", href: `/entry/${own.code}/checklists` },
          ]
        : [{ label: "Data Entry", href: "/entry" }],
    });
  }

  return (
    <ShellClient
      sections={sections}
      user={{ name: user.name, email: user.email, roleLabel: ROLE_LABELS[user.role] }}
    >
      {children}
    </ShellClient>
  );
}
