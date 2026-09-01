import type { Metadata } from "next";
import { listAllProperties } from "@/server/services/admin-service";
import { PropertiesAdmin } from "@/features/admin/properties-admin";

export const metadata: Metadata = { title: "Properties" };
export const dynamic = "force-dynamic";

export default async function AdminPropertiesPage() {
  const propertiesList = await listAllProperties();
  return (
    <div>
      <div className="mb-1 text-[11.5px] font-semibold tracking-wider text-muted uppercase">
        Administration
      </div>
      <h2 className="mb-1 text-[22px] font-bold">Properties</h2>
      <p className="mb-4 text-[13px] text-muted">
        Property master data drives navigation, permissions and every dashboard. Properties with
        historical records cannot be deleted — deactivate them instead.
      </p>
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
