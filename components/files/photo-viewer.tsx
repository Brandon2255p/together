"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon, ImageOffIcon, LoaderCircleIcon, ShareIcon, Trash2Icon, XIcon } from "lucide-react";
import type { Member } from "@/lib/models";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export interface PhotoViewerData {
  id: string;
  kind: "photo" | "video";
  name: string;
  /** "Thu 12 Nov 2026" */
  title: string;
  /** "3 of 10 · November" */
  position: string;
  /** the decrypted preview (photos) or original (videos), as a blob: URL; null while it loads */
  src: string | null;
  /** the grid's thumb, shown while the preview loads and as a video's poster */
  poster: string | null;
  /** the preview couldn't be made or opened */
  failed: boolean;
  addedBy: Pick<Member, "name" | "initial" | "tone"> | null;
  /** "Brandon added this · 13 Nov" */
  added: string;
  /** "Taken Thu 12 Nov 2026, 18:42" */
  taken: string;
  /** "IMG_2041.HEIC · 3.2 MB" */
  file: string;
}

export interface PhotoViewerProps {
  item: PhotoViewerData | null;
  busy: "download" | "share" | "bin" | null;
  error: string | null;
  /** Share shows only where the browser can share files */
  canShare: boolean;
  onClose: () => void;
  /** null at either end */
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  onDownload: () => void;
  onShare: () => void;
  onBin: () => void;
}

const SWIPE_PX = 50;

/** Screen 37: one photo or video full screen, on dark. Swipe (or the arrow keys) moves through the month. */
export function PhotoViewer({ item, busy, error, canShare, onClose, onPrev, onNext, onDownload, onShare, onBin }: PhotoViewerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const touchX = useRef<number | null>(null);
  const open = item !== null;

  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      before?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") onPrev?.();
      else if (e.key === "ArrowRight") onNext?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, onPrev, onNext]);

  if (!item) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label={`${item.kind === "video" ? "Video" : "Photo"}: ${item.title}`} className="fixed inset-0 z-50 flex flex-col bg-[#0f0c0b] text-white">
      <header className="flex items-center gap-3 px-5 pt-[max(env(safe-area-inset-top),16px)] pb-3">
        <DarkButton ref={closeRef} label="Close" onClick={onClose}>
          <XIcon />
        </DarkButton>
        <div className="flex min-w-0 flex-1 flex-col items-center text-center" aria-live="polite">
          <p className="truncate text-body">{item.title}</p>
          <p className="text-caption text-white/55">{item.position}</p>
        </div>
        <DarkButton label="Download" onClick={onDownload} disabled={busy !== null}>
          {busy === "download" ? <LoaderCircleIcon className="animate-spin" /> : <DownloadIcon />}
        </DarkButton>
      </header>

      <div
        className="relative min-h-0 flex-1 select-none"
        onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
        onTouchEnd={(e) => {
          const start = touchX.current;
          const end = e.changedTouches[0]?.clientX;
          touchX.current = null;
          if (start === null || end === undefined) return;
          if (end - start > SWIPE_PX) onPrev?.();
          else if (start - end > SWIPE_PX) onNext?.();
        }}
      >
        {item.kind === "video" && item.src ? (
          <video key={item.id} src={item.src} poster={item.poster ?? undefined} controls playsInline autoPlay className="absolute inset-0 size-full object-contain" />
        ) : item.src ? (
          <Image key={item.id} src={item.src} alt={item.name} fill unoptimized sizes="100vw" className="object-contain" />
        ) : item.poster && !item.failed ? (
          <Image key={`${item.id}-poster`} src={item.poster} alt="" fill unoptimized sizes="100vw" className="object-contain blur-sm" />
        ) : null}
        {!item.src && !item.failed ? <LoaderCircleIcon aria-label="Loading" className="absolute inset-0 m-auto size-7 animate-spin text-white/70" /> : null}
        {item.failed ? (
          <p className="absolute inset-0 m-auto flex h-fit max-w-64 flex-col items-center gap-2 text-center text-callout text-white/70">
            <ImageOffIcon aria-hidden className="size-7" />
            This one can&apos;t be shown here. Download it to open it.
          </p>
        ) : null}
        {onPrev ? (
          <DarkButton label="Previous" onClick={onPrev} className="absolute top-1/2 left-3 -translate-y-1/2 pointer-coarse:hidden">
            <ChevronLeftIcon />
          </DarkButton>
        ) : null}
        {onNext ? (
          <DarkButton label="Next" onClick={onNext} className="absolute top-1/2 right-3 -translate-y-1/2 pointer-coarse:hidden">
            <ChevronRightIcon />
          </DarkButton>
        ) : null}
      </div>

      <footer className="flex flex-col gap-3 px-5 pt-4 pb-[max(env(safe-area-inset-bottom),20px)]">
        <div className="flex flex-col gap-2 rounded-card bg-white/[0.08] p-4">
          <p className="flex items-center gap-2.5 text-callout">
            {item.addedBy ? <Avatar member={item.addedBy} size="md" className="ring-white/20" /> : null}
            {item.added}
          </p>
          <p className="text-caption text-white/60">{item.taken}</p>
          <p className="truncate text-caption text-white/45">{item.file}</p>
        </div>
        {error ? (
          <p role="alert" className="text-center text-callout text-[#ff9b85]">
            {error}
          </p>
        ) : null}
        <div className="flex gap-2.5">
          {canShare ? (
            <button
              type="button"
              onClick={onShare}
              disabled={busy !== null}
              className="flex h-[54px] flex-1 items-center justify-center gap-2 rounded-full bg-white/[0.12] text-body-strong transition-transform active:scale-[0.97] disabled:opacity-50"
            >
              {busy === "share" ? <LoaderCircleIcon aria-hidden className="size-5 animate-spin" /> : <ShareIcon aria-hidden className="size-5" />}
              Share
            </button>
          ) : null}
          <button
            type="button"
            onClick={onBin}
            disabled={busy !== null}
            className="flex h-[54px] flex-1 items-center justify-center gap-2 rounded-full bg-[#4a2118] text-body-strong text-[#ff9b85] transition-transform active:scale-[0.97] disabled:opacity-50"
          >
            {busy === "bin" ? <LoaderCircleIcon aria-hidden className="size-5 animate-spin" /> : <Trash2Icon aria-hidden className="size-5" />}
            Move to bin
          </button>
        </div>
      </footer>
    </div>
  );
}

function DarkButton({ label, className, children, ...props }: React.ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "grid size-11 shrink-0 place-items-center rounded-full bg-white/[0.12] transition-transform active:scale-[0.92] disabled:opacity-50 [&_svg]:size-5",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
