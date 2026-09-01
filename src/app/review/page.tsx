import type { Metadata } from "next";
import Link from "next/link";
import { listActiveProperties } from "@/server/services/metrics-service";
import { getReviewQueue } from "@/server/services/review-service";
import { listCategories } from "@/server/services/checklist-service";
import { reviewFilterSchema } from "@/lib/validation";
import { StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ReviewFilters } from "@/features/review/review-filters";
import { PublishWeekButton } from "@/features/review/publish-week-button";
import { formatDateTime } from "@/lib/utils";
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

  const [propertiesList, categories] = await Promise.all([listActiveProperties(), listCategories()]);
  const selectedProperty = propertiesList.find((p) => p.code === filters.property);

  const queue = await getReviewQueue({
    propertyId: selectedProperty?.id,
    type: filters.type,
    status: filters.status as WorkflowStatus | undefined,
    categoryKey: filters.category,
    week: filters.week,
    page: filters.page,
  });

  return (
    <div data-testid="review-queue">
      <div className="mb-1 text-[11.5px] font-semibold tracking-wider text-muted uppercase">
        Management Review
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[22px] font-bold">Review Queue</h2>
        <PublishWeekButton
          properties={propertiesList.map((p) => ({ id: p.id, name: p.name }))}
          defaultWeek={filters.week ?? currentWeekStart()}
        />
      </div>

      <ReviewFilters
        properties={propertiesList.map((p) => ({ code: p.code, name: p.name }))}
        categories={categories.map((c) => ({ key: c.key, name: c.name }))}
      />

      <Card className="mt-4 overflow-hidden">
        {queue.items.length === 0 ? (
          <div className="px-5 py-10 text-center text-[13px] text-muted">
            Nothing matches these filters. Submitted items appear here for review.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="z-table">
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Type</th>
                  <th>Date / Week</th>
                  <th>Submitted By</th>
                  <th>Submitted At</th>
                  <th style={{ width: 80 }}>Issues</th>
                  <th style={{ width: 90 }}>Evidence</th>
                  <th style={{ width: 100 }}>Status</th>
                  <th style={{ width: 70 }} />
                </tr>
              </thead>
              <tbody>
                {queue.items.map((item) => (
                  <tr key={`${item.kind}-${item.id}`} data-testid={`queue-row-${item.id}`}>
                    <td className="font-semibold">{item.propertyName}</td>
                    <td>{item.title}</td>
                    <td className="font-mono text-xs">{item.dateLabel}</td>
                    <td>{item.submittedByName ?? "—"}</td>
                    <td className="font-mono text-xs text-muted">{formatDateTime(item.submittedAt)}</td>
                    <td className="text-center font-mono">{item.issueCount}</td>
                    <td className="text-center font-mono">{item.evidenceCount}</td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td>
                      <Link
                        href={`/review/${item.kind}/${item.id}`}
                        className="text-[12.5px] font-bold text-accent-dark hover:underline"
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {queue.total > queue.pageSize ? (
        <p className="mt-3 text-center text-xs text-muted">
          Showing {queue.items.length} of {queue.total} items — refine filters or use page navigation
          (`?page=`).
        </p>
      ) : null}
    </div>
  );
}
