import type { Metadata } from "next";
import { listUsers, listAllProperties } from "@/server/services/admin-service";
import { UsersAdmin } from "@/features/admin/users-admin";
import { PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Users" };
export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const [users, propertiesList] = await Promise.all([listUsers(), listAllProperties()]);
  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Users"
        meta={`${users.length} accounts · site users are restricted to one property`}
      />
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
