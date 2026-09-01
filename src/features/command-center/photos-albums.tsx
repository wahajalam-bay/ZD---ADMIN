"use client";

import * as React from "react";
import { ArrowLeft, Camera, Images, Wrench } from "lucide-react";
import { AlbumGallery } from "./album-gallery";
import type { PhotoView } from "./photo-strip";
import { Lightbox } from "@/components/ui/lightbox";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { SectionHeader } from "@/components/ui/section-header";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "@/components/ui/icon";

export interface PropertyAlbumData {
  code: string;
  name: string;
  coverUrl: string | null;
  progress: PhotoView[];
  evidence: PhotoView[];
}

/**
 * Property-album media browser. Album cards carry real information (counts,
 * last upload); opening one shows the property's photos organised like its
 * checklist board, with damage/issue evidence in a clearly separate section.
 */
export function PhotosAlbums({
  albums,
  weekLabel,
  initialCode,
}: {
  albums: PropertyAlbumData[];
  weekLabel: string;
  /** Deep link from a drill-down (`?property=OPAL`) opens that album directly. */
  initialCode?: string | null;
}) {
  const [openCode, setOpenCode] = React.useState<string | null>(
    initialCode && albums.some((a) => a.code === initialCode) ? initialCode : null,
  );
  const [type, setType] = React.useState<"progress" | "evidence">("progress");
  const [evidenceLightbox, setEvidenceLightbox] = React.useState<number | null>(null);

  const open = albums.find((a) => a.code === openCode) ?? null;

  if (open) {
    return (
      <div data-testid={`property-album-${open.code}`}>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={() => setOpenCode(null)} data-testid="albums-back">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> All albums
          </Button>
          <h2 className="t-section">{open.name} Album</h2>
          <Segmented
            className="ms-auto"
            size="sm"
            ariaLabel="Media type"
            value={type}
            onChange={setType}
            options={[
              { value: "progress", label: "Progress Photos", icon: Images, count: open.progress.length },
              { value: "evidence", label: "Checklist Evidence", icon: Wrench, count: open.evidence.length },
            ]}
          />
        </div>

        {type === "progress" ? (
          <AlbumGallery
            propertyName={open.name}
            photos={open.progress}
            emptyText={`No progress photos were published for ${open.name} in ${weekLabel}.`}
          />
        ) : open.evidence.length === 0 ? (
          <EmptyState
            icon="wrench"
            title={`No checklist evidence for ${open.name} this week`}
            detail="Photos attached to flagged checklist points appear here once their entries are published."
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {open.evidence.map((p, i) => (
              <button
                key={p.id}
                onClick={() => setEvidenceLightbox(i)}
                className="group overflow-hidden rounded-card border border-bad/30 bg-panel text-start shadow-card transition-all hover:-translate-y-0.5 hover:border-bad hover:shadow-card-2"
              >
                { }
                <img src={p.thumbUrl} alt={p.caption} loading="lazy" className="h-[128px] w-full object-cover" />
                <div className="px-3 py-2">
                  <div className="line-clamp-2 flex items-start gap-1.5 text-[12px] leading-snug font-bold text-ink">
                    <Wrench className="mt-0.5 h-3 w-3 shrink-0 text-bad" aria-hidden />
                    {p.caption}
                  </div>
                  <div className="mt-0.5 truncate text-[10.5px] text-muted">{p.context}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {evidenceLightbox !== null ? (
          <Lightbox
            items={open.evidence.map((p) => ({ src: p.url, title: p.caption, subtitle: p.context }))}
            index={evidenceLightbox}
            onClose={() => setEvidenceLightbox(null)}
            onNavigate={setEvidenceLightbox}
          />
        ) : null}
      </div>
    );
  }

  const totalPhotos = albums.reduce((a, b) => a + b.progress.length + b.evidence.length, 0);

  return (
    <div data-testid="photos-albums">
      <SectionHeader
        title="Site albums"
        icon="images"
        description={`${totalPhotos} photos published across ${albums.length} properties for ${weekLabel}.`}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {albums.map((a) => (
          <button
            key={a.code}
            onClick={() => setOpenCode(a.code)}
            data-testid={`album-card-${a.code}`}
            className="group overflow-hidden rounded-card border border-line bg-panel text-start shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-card-2"
          >
            {a.coverUrl ? (
               
              <img src={a.coverUrl} alt="" className="h-[132px] w-full object-cover" />
            ) : (
              <div className="h-[92px] w-full bg-[image:var(--grad-hero)] opacity-90" aria-hidden />
            )}
            <div className="p-4">
              <h3 className="text-[15px] font-bold text-ink group-hover:text-accent-dark">
                {a.name} Album
              </h3>
              <div className="mt-2 flex flex-wrap gap-3 text-[11.5px] text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <Images className="h-3.5 w-3.5" aria-hidden />
                  <b className="font-mono text-ink">{a.progress.length}</b> progress
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Wrench className="h-3.5 w-3.5" aria-hidden />
                  <b className="font-mono text-ink">{a.evidence.length}</b> evidence
                </span>
              </div>
              <span className="mt-2.5 block text-[11px] font-bold text-accent-dark opacity-0 transition-opacity group-hover:opacity-100">
                Open album →
              </span>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <SecondaryState icon="video" label="Site Videos" detail="No videos submitted yet" />
        <SecondaryState icon="radio" label="Live Camera" detail="No feed configured" />
      </div>
    </div>
  );
}

function SecondaryState({
  icon,
  label,
  detail,
}: {
  icon: IconName;
  label: string;
  detail: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-input border border-dashed border-line bg-panel px-3 py-1.5 text-[11.5px]",
      )}
    >
      <Icon name={icon} className="h-3.5 w-3.5 text-muted" />
      <b className="font-semibold text-ink">{label}</b>
      <span className="text-muted">— {detail}</span>
    </span>
  );
}

export { Camera };
