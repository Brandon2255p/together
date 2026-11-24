"use client";

import { useEffect, useRef } from "react";
import { ImageIcon, PlayIcon } from "lucide-react";
import { Photo } from "@/components/ui/photo";
import { cn } from "@/lib/utils";

export interface GalleryTileData {
  id: string;
  /** "Photo taken 12 Nov 2026, 18:42" */
  label: string;
  /** the decrypted thumb (a blob: URL) once it's ready; null while it loads or when there isn't one */
  src: string | null;
  /** true when the item has no thumb to load (HEIC outside Safari, say): a placeholder shows */
  noThumb: boolean;
  /** "0:42" on videos */
  duration: string | null;
}

/** A square tile in the Gallery grid. It asks for its thumb (onVisible) once it's near the screen. */
export function GalleryTile({ tile, onOpen, onVisible }: { tile: GalleryTileData; onOpen: (id: string) => void; onVisible: (id: string) => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const wanted = !tile.src && !tile.noThumb;

  useEffect(() => {
    const el = ref.current;
    if (!el || !wanted) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          onVisible(tile.id);
        }
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [wanted, tile.id, onVisible]);

  return (
    <button
      ref={ref}
      type="button"
      aria-label={tile.label}
      onClick={() => onOpen(tile.id)}
      className={cn("relative aspect-square overflow-hidden bg-surface-muted transition-transform duration-200 active:scale-[0.97]", !tile.src && !tile.noThumb && "animate-pulse")}
    >
      {tile.src ? <Photo src={tile.src} sizes="33vw" /> : null}
      {tile.noThumb ? <ImageIcon aria-hidden className="absolute inset-0 m-auto size-6 text-ink-subtle" /> : null}
      {tile.duration ? (
        <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-chip bg-ink/60 px-2 py-0.5 text-caption font-semibold text-on-accent backdrop-blur-sm">
          <PlayIcon aria-hidden className="size-3 fill-current" />
          {tile.duration}
        </span>
      ) : null}
    </button>
  );
}
