"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Lightbox } from "@/components/ui/lightbox";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

interface GalleryPhotoView {
  id: string;
  url: string;
  thumbUrl: string;
  caption: string;
  context: string;
  propertyName: string;
}

/**
 * Media gallery with a clear split between weekly PROGRESS photos and
 * checklist EVIDENCE — the two are never merged into one anonymous album.
 * Includes the (honest) empty states for Site Videos and Live Camera.
 */
export function PhotosGallery({
  properties,
  selectedPropertyCode,
  weeklyPhotos,
  evidencePhotos,
}: {
  properties: Array<{ code: string; name: string }>;
  selectedPropertyCode: string | null;
  weeklyPhotos: GalleryPhotoView[];
  evidencePhotos: GalleryPhotoView[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [tab, setTab] = React.useState<"progress" | "evidence" | "video" | "camera">("progress");
  const [lightbox, setLightbox] = React.useState<{ list: GalleryPhotoView[]; index: number } | null>(null);

  function setProperty(code: string | null) {
    const next = new URLSearchParams(search.toString());
    if (code) next.set("property", code);
    else next.delete("property");
    router.push(`${pathname}?${next.toString()}`);
  }

  const tabs = [
    { key: "progress" as const, label: `Progress Photos (${weeklyPhotos.length})` },
    { key: "evidence" as const, label: `Checklist Evidence (${evidencePhotos.length})` },
    { key: "video" as const, label: "Site Videos" },
    { key: "camera" as const, label: "Live Camera" },
  ];

  const active = tab === "progress" ? weeklyPhotos : tab === "evidence" ? evidencePhotos : [];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Media type">
          {tabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "rounded-lg border px-3.5 py-1.5 text-[12.5px] font-bold",
                tab === t.key
                  ? "border-accent bg-accent text-white"
                  : "border-line bg-panel text-muted hover:bg-slate-50",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="ml-auto">
          <label htmlFor="gallery-property" className="sr-only">
            Filter by property
          </label>
          <select
            id="gallery-property"
            value={selectedPropertyCode ?? ""}
            onChange={(e) => setProperty(e.target.value || null)}
            className="rounded-lg border border-line bg-panel px-2.5 py-1.5 text-[12.5px] font-semibold"
          >
            <option value="">All properties</option>
            {properties.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {tab === "video" ? (
        <EmptyState
          title="No videos submitted"
          detail="The media model supports video, but no site videos have been submitted yet. This tab will populate automatically once video submissions are enabled."
        />
      ) : tab === "camera" ? (
        <EmptyState
          title="No live camera feeds configured"
          detail="Live camera integration is a configuration-only placeholder — no feed has been connected. Contact the administrator to configure camera sources."
        />
      ) : active.length === 0 ? (
        <EmptyState
          title={tab === "progress" ? "No progress photos for this selection" : "No checklist evidence for this selection"}
          detail="Try a different reporting week or property, or check that data for this period has been published."
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {active.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setLightbox({ list: active, index: i })}
              className="group overflow-hidden rounded-card border border-line bg-panel text-left shadow-card transition hover:-translate-y-0.5 hover:shadow-md"
            >
              { }
              <img src={p.thumbUrl} alt={p.caption} loading="lazy" className="h-[150px] w-full object-cover" />
              <div className="px-3.5 py-2.5">
                <div className="truncate text-[13px] font-semibold">{p.caption}</div>
                <div className="truncate text-[11px] text-muted">{p.context}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {lightbox ? (
        <Lightbox
          items={lightbox.list.map((p) => ({ src: p.url, title: p.caption, subtitle: p.context }))}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onNavigate={(i) => setLightbox((l) => (l ? { ...l, index: i } : l))}
        />
      ) : null}
    </div>
  );
}
