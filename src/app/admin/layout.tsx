import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { AccessDenied } from "@/components/shell/access-denied";
import { getSessionUser } from "@/server/auth/session";
import { canAdministerUsers } from "@/lib/roles";

export const dynamic = "force-dynamic";

/** Administration requires MANAGER_ADMIN (server-enforced on every action too). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!canAdministerUsers(user.role)) {
    return (
      <AppShell>
        <AccessDenied message="Administration requires the Manager/Admin role." />
      </AppShell>
    );
  }
  return <AppShell>{children}</AppShell>;
}
