import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { AccessDenied } from "@/components/shell/access-denied";
import { getSessionUser } from "@/server/auth/session";
import { canReview } from "@/lib/roles";

export const dynamic = "force-dynamic";

/** Review is a management surface: Assistant Manager and Manager/Admin only. */
export default async function ReviewLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!canReview(user.role)) {
    return (
      <AppShell>
        <AccessDenied message="The review queue is available to Assistant Managers and Managers only." />
      </AppShell>
    );
  }
  return <AppShell>{children}</AppShell>;
}
