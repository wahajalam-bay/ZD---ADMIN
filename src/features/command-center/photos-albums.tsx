"use client";

import * as React from "react";
import { ArrowLeft, Camera, Images, Video, Wrench } from "lucide-react";
import { AlbumGallery } from "./album-gallery";
import type { PhotoView } from "./photo-strip";
import { Lightbox } from "@/components/ui/lightbox";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export interface PropertyAlbumData {
  code: string;
  name: string;
  coverUrl: string | null;
  progress: PhotoView[];
  evidence: PhotoView[];
}

/**
 * Property-album media browser: one album per property (Opal / Aurum /
 * Quadrangle …). Opening an album shows that property's photos organised
 * like its checklist board — Site Overview header, sorted caption albums
 * (site photos + checklist/maintenance sheet images) — plus a clearly
 * separated "Damage / Issue Evidence" section holding the defect-report
 * photographs attached to exact checklist points.
 */
export function PhotosAlbums({ albums }: { albums: PropertyAlbumData[] }) {
  const [openCode, setOpenCode] = React.useState<string | null>(null);
  const [evidenceLightbox, setEvidenceLightbox] = React.useState<number | null>(null);

  const open = albums.find((a) => a.code === openCode) ?? null;

  if (open) {
    return (
      <div data-testid={`property-album-${open.code}`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <Button size="sm" onClick={() => setOpenCode(null)} data-testid="albums-back">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> All albums
          </Button>
          <h3 className="text-[16px] font-bold">{open.name} Album</h3>
          <div className="flex gap-3 font-mono text-[11px] text-muted">
            <span>{open.progress.length} site/sheet photos</span>
            <span>{open.evidence.length} damage evidence</span>
          </div>
        </div>

        <AlbumGallery
          propertyName={open.name}
          photos={open.progress}
          emptyText="No published site or sheet photos for this selection."
        />

        <div className="secbar">
          <h3>Damage / Issue Evidence</h3>
          <div className="line" />
        </div>
        {open.evidence.length === 0 ? (
          <EmptyState
            title="No damage-report evidence for this week"
            detail="Photos attached to flagged checklist points appear here once their entries are published."
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {open.evidence.map((p, i) => (
              <button
                key={p.id}
                onClick={() => setEvidenceLightbox(i)}
                className="group overflow-hidden rounded-card border border-bad/40 bg-panel text-left shadow-card transition hover:-translate-y-0.5 hover:border-bad hover:shadow-md"
              >
                { }
                <img src={p.thumbUrl} alt={p.caption} loading="lazy" className="h-[130px] w-full object-cover" />
                <div className="px-3 py-2">
                  <div className="line-clamp-2 flex items-start gap-1.5 text-[12px] leading-snug font-bold">
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

  return (
    <div data-testid="photos-albums">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {albums.map((a) => (
          <button
            key={a.code}
            onClick={() => setOpenCode(a.code)}
            data-testid={`album-card-${a.code}`}
            className="group overflow-hidden rounded-card border border-line bg-panel text-left shadow-card transition hover:-translate-y-0.5 hover:border-accent hover:shadow-md"
          >
            {a.coverUrl ? (
               
              <img src={a.coverUrl} alt={`${a.name} album cover`} className="h-[180px] w-full object-cover" />
            ) : (
              <div className="flex h-[130px] items-center justify-center bg-gradient-to-br from-accent-light to-slate-100 font-mono text-3xl font-extrabold text-accent-dark/40">
                {a.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="px-4.5 flex items-center justify-between p-4">
              <div>
                <h3 className="text-[16px] font-bold group-hover:text-accent-dark">{a.name} Album</h3>
                <div className="mt-1 flex gap-3 text-[11.5px] text-muted">
                  <span className="flex items-center gap-1">
                    <Images className="h-3 w-3" aria-hidden />
                    {a.progress.length} photos
                  </span>
                  <span className="flex items-center gap-1">
                    <Wrench className="h-3 w-3" aria-hidden />
                    {a.evidence.length} damage evidence
                  </span>
                </div>
              </div>
              <span className="font-mono text-[11px] font-bold text-accent-dark">Open →</span>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-2 text-[11.5px] text-muted">
        <span className="flex items-center gap-1.5 rounded-lg border border-dashed border-line bg-panel px-3 py-1.5">
          <Video className="h-3.5 w-3.5" aria-hidden /> Site Videos — none submitted yet
        </span>
        <span className="flex items-center gap-1.5 rounded-lg border border-dashed border-line bg-panel px-3 py-1.5">
          <Camera className="h-3.5 w-3.5" aria-hidden /> Live Camera — no feed configured
        </span>
      </div>
    </div>
  );
}
