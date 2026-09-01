import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { AccessDenied } from "@/components/shell/access-denied";
import { getSessionUser } from "@/server/auth/session";
import { canViewAllProperties } from "@/lib/roles";

export const dynamic = "force-dynamic";

/**
 * The Command Center is the management-facing live dashboard: it requires a
 * management role (server-enforced). Site users work in /entry.
 */
export default async function CommandCenterLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!canViewAllProperties(user.role)) {
    return (
      <AppShell>
        <AccessDenied message="The Command Center is available to management roles only." />
      </AppShell>
    );
  }
  return <AppShell>{children}</AppShell>;
}
