import { notFound } from "next/navigation";
import { getPropertyByCode } from "@/server/permissions";
import { requirePageUser } from "@/server/auth/session";
import { getWeeklyReportView } from "@/server/services/weekly-report-service";
import { canEditSubmission } from "@/lib/roles";
import { currentWeekStart, isIsoDate, weekStartOf } from "@/lib/week";
import { mediaUrl } from "@/lib/media-url";
import { WeeklyReportForm } from "@/features/entry/weekly-report-form";

export const dynamic = "force-dynamic";

export default async function WeeklyReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ propertyCode: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const { propertyCode } = await params;
  const sp = await searchParams;
  const property = await getPropertyByCode(propertyCode);
  if (!property) notFound();
  const user = await requirePageUser();

  const weekStart = sp.week && isIsoDate(sp.week) ? weekStartOf(sp.week) : currentWeekStart();
  const { report, tasks, media } = await getWeeklyReportView(property.id, weekStart);
  const status = report?.workflowStatus ?? null;

  return (
    <WeeklyReportForm
      propertyCode={property.code}
      weekStart={weekStart}
      status={status}
      canEdit={canEditSubmission(user.role, status ?? "DRAFT")}
      reportId={report?.id ?? null}
      initial={{
        trackingStatus: report?.trackingStatus ?? "ON_TRACK",
        summary: report?.summary ?? "",
        notes: report?.notes ?? "",
        tasks: tasks.map((t) => ({
          task: t.task,
          status: t.status,
          etaDate: t.etaDate,
        })),
      }}
      media={media.map((m) => ({
        id: m.id,
        url: mediaUrl(m.storageKey),
        thumbUrl: mediaUrl(m.thumbnailKey),
        caption: m.caption,
      }))}
      returnReason={status === "RETURNED" ? (report?.returnReason ?? "") : ""}
      reviewNotes={report?.reviewNotes ?? ""}
    />
  );
}
