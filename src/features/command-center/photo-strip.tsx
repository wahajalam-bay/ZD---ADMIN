"use client";

import * as React from "react";
import { Lightbox } from "@/components/ui/lightbox";
import { EmptyState } from "@/components/ui/empty-state";

export interface PhotoView {
  id: string;
  url: string;
  thumbUrl: string;
  caption: string;
  context: string;
}

/** Thumbnail grid + lightbox for property progress media. */
export function PhotoStrip({ photos, emptyText }: { photos: PhotoView[]; emptyText: string }) {
  const [index, setIndex] = React.useState<number | null>(null);

  if (photos.length === 0) {
    return <EmptyState title={emptyText} />;
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((p, i) => (
          <button
            key={p.id}
            onClick={() => setIndex(i)}
            className="group overflow-hidden rounded-card border border-line bg-panel text-left shadow-card transition hover:-translate-y-0.5 hover:shadow-md"
          >
            { }
            <img
              src={p.thumbUrl}
              alt={p.caption}
              loading="lazy"
              className="h-[120px] w-full object-cover"
            />
            <div className="px-3 py-2">
              <div className="truncate text-[12.5px] font-semibold">{p.caption}</div>
              <div className="truncate text-[10.5px] text-muted">{p.context}</div>
            </div>
          </button>
        ))}
      </div>
      {index !== null ? (
        <Lightbox
          items={photos.map((p) => ({ src: p.url, title: p.caption, subtitle: p.context }))}
          index={index}
          onClose={() => setIndex(null)}
          onNavigate={setIndex}
        />
      ) : null}
    </>
  );
}
