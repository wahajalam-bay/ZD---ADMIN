import type { Metadata } from "next";
import { listUsers, listAllProperties } from "@/server/services/admin-service";
import { UsersAdmin } from "@/features/admin/users-admin";

export const metadata: Metadata = { title: "Users" };
export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const [users, propertiesList] = await Promise.all([listUsers(), listAllProperties()]);
  return (
    <div>
      <div className="mb-1 text-[11.5px] font-semibold tracking-wider text-muted uppercase">
        Administration
      </div>
      <h2 className="mb-4 text-[22px] font-bold">Users</h2>
      <UsersAdmin
        users={users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          banned: u.banned,
          propertyId: u.propertyId,
          propertyName: u.propertyName,
          createdAt: u.createdAt.toISOString(),
        }))}
        properties={propertiesList
          .filter((p) => p.active)
          .map((p) => ({ id: p.id, name: p.name }))}
      />
    </div>
  );
}
