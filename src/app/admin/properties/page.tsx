import type { Metadata } from "next";
import { listAllProperties } from "@/server/services/admin-service";
import { PropertiesAdmin } from "@/features/admin/properties-admin";
import { PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Properties" };
export const dynamic = "force-dynamic";

export default async function AdminPropertiesPage() {
  const propertiesList = await listAllProperties();
  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Properties"
        meta="Master data drives navigation, permissions and every dashboard. Properties with historical records are deactivated, never deleted."
      />
      <PropertiesAdmin
        properties={propertiesList.map((p) => ({
          id: p.id,
          code: p.code,
          name: p.name,
          location: p.location,
          propertyType: p.propertyType,
          areaSqFt: p.areaSqFt,
          areaLabel: p.areaLabel,
          developmentStatus: p.developmentStatus,
          operationalStatus: p.operationalStatus,
          statusIndicator: p.statusIndicator,
          phaseCode: p.phaseCode,
          displayOrder: p.displayOrder,
          active: p.active,
        }))}
      />
    </div>
  );
}
