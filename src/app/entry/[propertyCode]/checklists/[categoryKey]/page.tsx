import { notFound } from "next/navigation";
import { getPropertyByCode } from "@/server/permissions";
import { requirePageUser } from "@/server/auth/session";
import { getEntryView } from "@/server/services/checklist-service";
import { canEditSubmission } from "@/lib/roles";
import { isIsoDate, todayStr } from "@/lib/week";
import { mediaUrl } from "@/lib/media-url";
import { ChecklistEntryForm } from "@/features/entry/checklist-entry-form";
import { PageHeader } from "@/components/shell/page-header";

export const dynamic = "force-dynamic";

export default async function ChecklistEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ propertyCode: string; categoryKey: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { propertyCode, categoryKey } = await params;
  const sp = await searchParams;
  const property = await getPropertyByCode(propertyCode);
  if (!property) notFound();
  const user = await requirePageUser();

  const date = sp.date && isIsoDate(sp.date) ? sp.date : todayStr();
  const view = await getEntryView(property.id, categoryKey, date);
  if (!view) notFound();

  const status = view.entry?.workflowStatus ?? null;
  const canEdit = canEditSubmission(user.role, status ?? "DRAFT");

  const responses: Record<
    string,
    {
      responseId: string | null;
      op: boolean;
      cl: boolean;
      comment: string;
      severity: string | null;
      photos: Array<{ id: string; url: string; thumbUrl: string; caption: string }>;
    }
  > = {};
  for (const item of view.items) {
    const r = view.responses.get(item.id);
    responses[item.id] = {
      responseId: r?.id ?? null,
      op: r?.op ?? false,
      cl: r?.cl ?? false,
      comment: r?.comment ?? "",
      severity: r?.severity ?? null,
      photos: (r?.photos ?? []).map((p) => ({
        id: p.id,
        url: mediaUrl(p.storageKey),
        thumbUrl: mediaUrl(p.thumbnailKey),
        caption: p.caption,
      })),
    };
  }

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: property.name, href: `/entry/${property.code}` },
          { label: "Daily Checklists", href: `/entry/${property.code}/checklists?date=${date}` },
          { label: view.category.name },
        ]}
        title={view.category.name}
        meta={date}
      />
      <ChecklistEntryForm
        propertyCode={property.code}
        category={{
          id: view.category.id,
          key: view.category.key,
          name: view.category.name,
          type: view.category.type,
        }}
        items={view.items.map((i) => ({ id: i.id, name: i.name }))}
        fieldDefs={view.fieldDefs.map((f) => ({ id: f.id, label: f.label, required: f.required }))}
        date={date}
        status={status}
        canEdit={canEdit}
        initialValues={view.values}
        initialResponses={responses}
        signs={{
          duty: view.entry?.signDutyTechnician ?? "",
          am: view.entry?.signAmAdmin ?? "",
          manager: view.entry?.signManagerAdmin ?? "",
        }}
        returnReason={view.entry?.workflowStatus === "RETURNED" ? (view.entry.returnReason ?? "") : ""}
        reviewNotes={view.entry?.reviewNotes ?? ""}
      />
    </div>
  );
}
