"use client";

import * as React from "react";
import { Images } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Lightbox } from "@/components/ui/lightbox";
import { EmptyState } from "@/components/ui/empty-state";
import type { PhotoView } from "./photo-strip";

interface Album {
  title: string;
  photos: PhotoView[];
}

/**
 * Deck-style media browser: photos are grouped into albums by caption in
 * their original document order — "Site Overview" is the main header card,
 * the rest form a checklist-board-style card grid. Opening a card shows the
 * album as a sorted document; any photo opens the lightbox within the album.
 */
export function AlbumGallery({
  photos,
  propertyName,
  emptyText,
}: {
  photos: PhotoView[];
  propertyName: string;
  emptyText: string;
}) {
  const [openAlbum, setOpenAlbum] = React.useState<Album | null>(null);
  const [lightbox, setLightbox] = React.useState<{ album: Album; index: number } | null>(null);

  const { hero, albums } = React.useMemo(() => {
    const groups = new Map<string, Album>();
    for (const p of photos) {
      const title = p.caption || "Photos";
      const album = groups.get(title) ?? { title, photos: [] };
      album.photos.push(p);
      groups.set(title, album);
    }
    const all = [...groups.values()];
    const heroIdx = all.findIndex((a) => a.title.trim().toLowerCase() === "site overview");
    const heroAlbum = heroIdx >= 0 ? all.splice(heroIdx, 1)[0]! : null;
    return { hero: heroAlbum, albums: all };
  }, [photos]);

  if (photos.length === 0) {
    return <EmptyState title={emptyText} />;
  }

  function openLightbox(album: Album, index: number) {
    setLightbox({ album, index });
  }

  return (
    <div data-testid="album-gallery">
      {/* Main header: Site Overview */}
      {hero ? (
        <button
          onClick={() => (hero.photos.length > 1 ? setOpenAlbum(hero) : openLightbox(hero, 0))}
          className="group relative mb-4 block w-full overflow-hidden rounded-card border border-line bg-panel text-left shadow-card transition hover:-translate-y-0.5 hover:shadow-md"
          data-testid="album-site-overview"
        >
          { }
          <img
            src={hero.photos[0]!.url}
            alt={`${propertyName} site overview`}
            className="h-[240px] w-full object-cover sm:h-[300px]"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/75 to-transparent px-5 pt-10 pb-4">
            <div className="text-[11px] font-bold tracking-wider text-white/70 uppercase">
              {propertyName}
            </div>
            <div className="flex items-center gap-2 text-[19px] font-bold text-white">
              Site Overview
              <span className="rounded-full bg-white/20 px-2 py-0.5 font-mono text-[11px]">
                {hero.photos.length} photo{hero.photos.length > 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </button>
      ) : null}

      {/* Album cards, in document order */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {albums.map((album) => (
          <button
            key={album.title}
            onClick={() => setOpenAlbum(album)}
            className="group overflow-hidden rounded-card border border-line bg-panel text-left shadow-card transition hover:-translate-y-0.5 hover:border-accent hover:shadow-md"
          >
            <div className="relative">
              { }
              <img
                src={album.photos[0]!.thumbUrl}
                alt={album.title}
                loading="lazy"
                className="h-[110px] w-full object-cover"
              />
              {album.photos.length > 1 ? (
                <span className="absolute right-1.5 bottom-1.5 flex items-center gap-1 rounded-md bg-slate-950/65 px-1.5 py-0.5 font-mono text-[10.5px] font-bold text-white">
                  <Images className="h-3 w-3" aria-hidden />
                  {album.photos.length}
                </span>
              ) : null}
            </div>
            <div className="px-3 py-2.5">
              <div className="line-clamp-2 text-[12.5px] leading-snug font-bold group-hover:text-accent-dark">
                {album.title}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Album document view: photos in sorted order */}
      <Dialog
        open={openAlbum !== null}
        onClose={() => setOpenAlbum(null)}
        title={openAlbum?.title ?? ""}
        subtitle={
          openAlbum
            ? `${propertyName} · ${openAlbum.photos.length} photo${openAlbum.photos.length > 1 ? "s" : ""} in document order`
            : undefined
        }
        wide
      >
        {openAlbum ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {openAlbum.photos.map((p, i) => (
              <button
                key={p.id}
                onClick={() => openLightbox(openAlbum, i)}
                className="overflow-hidden rounded-card border border-line text-left transition hover:-translate-y-0.5 hover:border-accent hover:shadow-md"
              >
                { }
                <img src={p.thumbUrl} alt={p.caption} loading="lazy" className="h-[130px] w-full object-cover" />
                <div className="px-2.5 py-1.5 font-mono text-[10.5px] text-muted">
                  {i + 1} of {openAlbum.photos.length}
                </div>
              </button>
            ))}
          </div>
        ) : null}
      </Dialog>

      {lightbox ? (
        <Lightbox
          items={lightbox.album.photos.map((p) => ({
            src: p.url,
            title: p.caption,
            subtitle: `${propertyName} · ${lightbox.album.title}`,
          }))}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onNavigate={(i) => setLightbox((l) => (l ? { ...l, index: i } : l))}
        />
      ) : null}
    </div>
  );
}
