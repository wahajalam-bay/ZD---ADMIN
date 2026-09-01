import { notFound } from "next/navigation";
import { getPropertyByCode } from "@/server/permissions";
import { getChecklistBoard } from "@/server/services/checklist-service";
import { PageHeader } from "@/components/shell/page-header";
import { ChecklistBoard } from "@/features/entry/checklist-board";
import { isIsoDate, todayStr } from "@/lib/week";

export const dynamic = "force-dynamic";

/** Daily checklist board: search, status filters, returned items float up. */
export default async function ChecklistBoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ propertyCode: string }>;
  searchParams: Promise<{ date?: string; filter?: string }>;
}) {
  const { propertyCode } = await params;
  const sp = await searchParams;
  const property = await getPropertyByCode(propertyCode);
  if (!property) notFound();

  const date = sp.date && isIsoDate(sp.date) ? sp.date : todayStr();
  const board = await getChecklistBoard(property.id, date);
  const filed = board.filter(
    (b) => b.entry && ["SUBMITTED", "APPROVED", "PUBLISHED"].includes(b.entry.workflowStatus),
  ).length;

  const longDate = new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div data-testid="checklist-board">
      <PageHeader
        breadcrumb={[
          { label: property.name, href: `/entry/${property.code}` },
          { label: "Daily Checklists" },
        ]}
        title="Daily Checklists"
        meta={
          <>
            {longDate} · {filed} of {board.length} completed
          </>
        }
      />
      <ChecklistBoard
        propertyCode={property.code}
        date={date}
        initialFilter={sp.filter ?? "ALL"}
        items={board.map(({ category, entry }) => ({
          key: category.key,
          name: category.name,
          type: category.type,
          itemCount: category.type === "LOG" ? 0 : (category.itemCount ?? 0),
          status: entry?.workflowStatus ?? null,
        }))}
      />
    </div>
  );
}
