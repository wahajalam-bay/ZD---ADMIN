import type { Metadata } from "next";
import { getSessionUser } from "@/server/auth/session";
import { canReview } from "@/lib/roles";
import { listActiveProperties, PREVIEW, PUBLISHED_ONLY } from "@/server/services/metrics-service";
import {
  listKnownWeeks,
  resolveSelectedWeek,
  weekDataState,
} from "@/server/services/reporting-week-service";
import { evidencePhotosForWeek, weeklyPhotosForWeek } from "@/server/services/media-service";
import { WeekSelector } from "@/components/shell/week-selector";
import { PhotosGallery } from "@/features/command-center/photos-gallery";
import { mediaUrl } from "@/lib/media-url";

export const metadata: Metadata = { title: "Progress Photos" };
export const dynamic = "force-dynamic";

export default async function PhotosPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; preview?: string; property?: string }>;
}) {
  const sp = await searchParams;
  const user = (await getSessionUser())!;
  const previewAllowed = canReview(user.role);
  const previewOn = previewAllowed && sp.preview === "1";
  const statuses = previewOn ? PREVIEW : PUBLISHED_ONLY;

  const week = await resolveSelectedWeek(sp.week);
  const propertiesList = await listActiveProperties();
  const selectedProperty = propertiesList.find((p) => p.code === sp.property) ?? null;

  const [weeks, state, weeklyPhotos, evidencePhotos] = await Promise.all([
    listKnownWeeks(),
    weekDataState(week),
    weeklyPhotosForWeek(week, statuses, selectedProperty?.id),
    evidencePhotosForWeek(week, statuses, selectedProperty?.id),
  ]);

  const toView = (list: typeof weeklyPhotos) =>
    list.map((p) => ({
      id: p.id,
      url: mediaUrl(p.storageKey),
      thumbUrl: mediaUrl(p.thumbnailKey),
      caption: p.caption,
      context: `${p.propertyName} · ${p.context}`,
      propertyName: p.propertyName,
    }));

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 text-[11.5px] font-semibold tracking-wider text-muted uppercase">Media</div>
          <h2 className="text-[22px] font-bold">Progress Photos</h2>
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

      <PhotosGallery
        properties={propertiesList.map((p) => ({ code: p.code, name: p.name }))}
        selectedPropertyCode={selectedProperty?.code ?? null}
        weeklyPhotos={toView(weeklyPhotos)}
        evidencePhotos={toView(evidencePhotos)}
      />
    </div>
  );
}
