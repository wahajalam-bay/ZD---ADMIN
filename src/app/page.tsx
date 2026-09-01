import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";
import { canViewAllProperties } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (canViewAllProperties(user.role)) redirect("/command-center");
  redirect("/entry");
}
