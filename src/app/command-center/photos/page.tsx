import type { Metadata } from "next";
import { requirePageUser } from "@/server/auth/session";
import { canReview } from "@/lib/roles";
import { listActiveProperties, PREVIEW, PUBLISHED_ONLY } from "@/server/services/metrics-service";
import {
  listKnownWeeks,
  resolveSelectedWeek,
  weekDataState,
} from "@/server/services/reporting-week-service";
import { evidencePhotosForWeek, weeklyPhotosForWeek } from "@/server/services/media-service";
import { PageHeader } from "@/components/shell/page-header";
import { ReportingControls, PreviewNotice } from "@/components/shell/reporting-controls";
import { ModeSwitcher } from "@/components/theme/mode-switcher";
import { PhotosAlbums } from "@/features/command-center/photos-albums";
import { weekRangeLabel } from "@/lib/week";
import { mediaUrl } from "@/lib/media-url";

export const metadata: Metadata = { title: "Progress Media" };
export const dynamic = "force-dynamic";

export default async function PhotosPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; preview?: string; property?: string }>;
}) {
  const sp = await searchParams;
  const user = await requirePageUser();
  const previewAllowed = canReview(user.role);
  const previewOn = previewAllowed && sp.preview === "1";
  const statuses = previewOn ? PREVIEW : PUBLISHED_ONLY;

  const week = await resolveSelectedWeek(sp.week);
  const [propertiesList, weeks, state, weeklyPhotos, evidencePhotos] = await Promise.all([
    listActiveProperties(),
    listKnownWeeks(),
    weekDataState(week),
    weeklyPhotosForWeek(week, statuses),
    evidencePhotosForWeek(week, statuses),
  ]);

  const albums = propertiesList.map((p) => {
    const progress = weeklyPhotos
      .filter((ph) => ph.propertyId === p.id)
      .map((ph) => ({
        id: ph.id,
        url: mediaUrl(ph.storageKey),
        thumbUrl: mediaUrl(ph.thumbnailKey),
        caption: ph.caption,
        context: ph.context,
      }));
    const evidence = evidencePhotos
      .filter((ph) => ph.propertyId === p.id)
      .map((ph) => ({
        id: ph.id,
        url: mediaUrl(ph.storageKey),
        thumbUrl: mediaUrl(ph.thumbnailKey),
        caption: ph.caption,
        context: ph.context,
      }));
    return {
      code: p.code,
      name: p.name,
      coverUrl: p.heroImageKey ? mediaUrl(p.heroImageKey) : (progress[0]?.thumbUrl ?? null),
      progress,
      evidence,
    };
  });

  const total = weeklyPhotos.length + evidencePhotos.length;

  return (
    <div>
      <PageHeader
        eyebrow="Media"
        title="Progress Media"
        meta={
          <>
            {weekRangeLabel(week)} · {weeklyPhotos.length} progress photos ·{" "}
            {evidencePhotos.length} checklist evidence · {total} total
          </>
        }
        controls={
          <>
            <ReportingControls
              weeks={weeks}
              selected={week}
              dataState={previewOn && state === "PREVIEW" ? "PREVIEW" : state}
              canPreview={previewAllowed}
              previewOn={previewOn}
            />
            <ModeSwitcher />
          </>
        }
      />

      {previewOn ? <PreviewNotice weekStart={week} /> : null}

      <PhotosAlbums
        albums={albums}
        weekLabel={weekRangeLabel(week)}
        initialCode={sp.property ?? null}
      />
    </div>
  );
}
