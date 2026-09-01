"use client";

import * as React from "react";
import { Lightbox } from "@/components/ui/lightbox";

/** Inline evidence thumbnails opening ONLY this response's photos. */
export function EvidenceThumbs({
  photos,
  title,
}: {
  photos: Array<{ id: string; url: string; thumbUrl: string; caption: string }>;
  title: string;
}) {
  const [index, setIndex] = React.useState<number | null>(null);
  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {photos.map((p, i) => (
          <button key={p.id} onClick={() => setIndex(i)} aria-label={`View evidence: ${p.caption}`}>
            { }
            <img
              src={p.thumbUrl}
              alt={p.caption}
              className="h-9 w-9 rounded-md border border-line object-cover hover:border-accent"
            />
          </button>
        ))}
      </div>
      {index !== null ? (
        <Lightbox
          items={photos.map((p) => ({ src: p.url, title: p.caption, subtitle: title }))}
          index={index}
          onClose={() => setIndex(null)}
          onNavigate={setIndex}
        />
      ) : null}
    </>
  );
}
