import type { Metadata } from "next";
import { listActiveProperties } from "@/server/services/metrics-service";
import { getReviewQueue, reviewQueueCounts } from "@/server/services/review-service";
import { listCategories } from "@/server/services/checklist-service";
import { reviewFilterSchema } from "@/lib/validation";
import { PageHeader } from "@/components/shell/page-header";
import { ModeSwitcher } from "@/components/theme/mode-switcher";
import { ReviewQueue } from "@/features/review/review-queue";
import { PublishWeekButton } from "@/features/review/publish-week-button";
import { currentWeekStart } from "@/lib/week";
import type { WorkflowStatus } from "@/lib/roles";

export const metadata: Metadata = { title: "Review Queue" };
export const dynamic = "force-dynamic";

export default async function ReviewQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const raw = await searchParams;
  const parsed = reviewFilterSchema.safeParse(raw);
  const filters = parsed.success ? parsed.data : reviewFilterSchema.parse({});

  const [propertiesList, categories, counts] = await Promise.all([
    listActiveProperties(),
    listCategories(),
    reviewQueueCounts(),
  ]);
  const selectedProperty = propertiesList.find((p) => p.code === filters.property);

  const queue = await getReviewQueue({
    propertyId: selectedProperty?.id,
    type: filters.type,
    status: (filters.status as WorkflowStatus | undefined) ?? "SUBMITTED",
    categoryKey: filters.category,
    week: filters.week,
    page: filters.page,
  });

  return (
    <div data-testid="review-queue">
      <PageHeader
        eyebrow="Management Review"
        title="Review Queue"
        meta={
          <>
            {counts.SUBMITTED} awaiting review · {counts.RETURNED} returned · {counts.APPROVED} approved
            and ready to publish
          </>
        }
        controls={
          <>
            <PublishWeekButton
              properties={propertiesList.map((p) => ({ id: p.id, name: p.name }))}
              defaultWeek={filters.week ?? currentWeekStart()}
            />
            <ModeSwitcher />
          </>
        }
      />

      <ReviewQueue
        items={queue.items.map((i) => ({
          kind: i.kind,
          id: i.id,
          propertyName: i.propertyName,
          title: i.title,
          dateLabel: i.dateLabel,
          status: i.status,
          submittedByName: i.submittedByName,
          submittedAt: i.submittedAt ? i.submittedAt.toISOString() : null,
          issueCount: i.issueCount,
          evidenceCount: i.evidenceCount,
        }))}
        counts={counts}
        properties={propertiesList.map((p) => ({ code: p.code, name: p.name }))}
        categories={categories.map((c) => ({ key: c.key, name: c.name }))}
        total={queue.total}
      />
    </div>
  );
}
