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
import { WeekSelector } from "@/components/shell/week-selector";
import { PhotosAlbums } from "@/features/command-center/photos-albums";
import { mediaUrl } from "@/lib/media-url";

export const metadata: Metadata = { title: "Progress Photos" };
export const dynamic = "force-dynamic";

/**
 * Media page: one album per property. Inside each album the photos are
 * organised like the property's checklist board (Site Overview header +
 * sorted caption albums covering site photos and checklist/maintenance sheet
 * images), with damage-report evidence in its own clearly-marked section.
 */
export default async function PhotosPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; preview?: string }>;
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
        context: `${p.name} · ${ph.context}`,
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

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 text-[11.5px] font-semibold tracking-wider text-muted uppercase">Media</div>
          <h2 className="text-[22px] font-bold">Site Albums</h2>
          <div className="mt-2">
            <WeekSelector
              weeks={weeks}
              selected={week}
              dataState={previewOn && state === "PREVIEW" ? "PREVIEW" : state}
              canPreview={previewAllowed}
              previewOn={previewOn}
            />
          </div>
        </div>
      </div>

      <PhotosAlbums albums={albums} />
    </div>
  );
}
