import Link from "next/link";
import { notFound } from "next/navigation";
import { getPropertyByCode } from "@/server/permissions";
import { getChecklistBoard } from "@/server/services/checklist-service";
import { StatusBadge } from "@/components/ui/badge";
import { isIsoDate, todayStr } from "@/lib/week";
import { DatePicker } from "@/features/entry/date-picker";

export const dynamic = "force-dynamic";

/** All 22 reference categories with per-day status, for one property + date. */
export default async function ChecklistBoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ propertyCode: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { propertyCode } = await params;
  const sp = await searchParams;
  const property = await getPropertyByCode(propertyCode);
  if (!property) notFound();

  const date = sp.date && isIsoDate(sp.date) ? sp.date : todayStr();
  const board = await getChecklistBoard(property.id, date);

  return (
    <div data-testid="checklist-board">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-muted">
          {board.length} checklist categories · pick the date, mark OP/CL per item, flag defects with
          evidence, then submit for review.
        </p>
        <DatePicker date={date} />
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {board.map(({ category, entry }) => (
          <Link
            key={category.id}
            href={`/entry/${property.code}/checklists/${category.key}?date=${date}`}
            data-testid={`category-${category.key}`}
            className="rounded-card border border-line bg-panel px-4 py-3 shadow-card transition hover:-translate-y-0.5 hover:border-accent"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="text-[13.5px] leading-snug font-bold">{category.name}</div>
              <span className="mt-0.5 shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-muted uppercase">
                {category.type}
              </span>
            </div>
            <div className="mt-2">
              <StatusBadge status={entry?.workflowStatus ?? null} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
