"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ChevronLeftIcon, ImagesIcon, LoaderCircleIcon, SearchIcon, UploadIcon, XIcon } from "lucide-react";
import { PillButton } from "@/components/ui/chip";
import { IconButton } from "@/components/ui/icon-button";
import { EmptyState, InlineError, ScreenHeader } from "@/components/ui/layout";
import { Reveal, RevealItem } from "@/components/ui/motion";
import { TextField } from "@/components/ui/text-field";
import type { GalleryFilter } from "@/lib/files/gallery";
import { GalleryTile, type GalleryTileData } from "./gallery-tile";
import { PhotoViewer, type PhotoViewerProps } from "./photo-viewer";
import { UploadSheet, type UploadSheetProps } from "./upload-sheet";

export interface GalleryMonthData {
  key: string;
  /** "November 2026" */
  title: string;
  /** "9 photos · 1 video" */
  summary: string;
  tiles: GalleryTileData[];
}

export interface GalleryScreenProps {
  back: { href: Route; label: string };
  query: string;
  onQueryChange: (query: string) => void;
  filter: GalleryFilter;
  onFilter: (filter: GalleryFilter) => void;
  months: GalleryMonthData[];
  /** what to say when nothing shows: nothing here yet, or nothing matches */
  empty: { title: string; body: string } | null;
  /** more pages to load as the grid scrolls */
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onOpen: (id: string) => void;
  onThumbWanted: (id: string) => void;
  onUpload: (files: File[]) => void;
  uploading: boolean;
  error: string | null;
  viewer: PhotoViewerProps;
  uploadSheet: UploadSheetProps;
}

const FILTERS: { value: GalleryFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "photo", label: "Photos" },
  { value: "video", label: "Videos" },
];

/** Screen 36: photos and videos by month taken, newest first */
export function GalleryScreen(props: GalleryScreenProps) {
  const { back, query, onQueryChange, filter, onFilter, months, empty, hasMore, loadingMore, onLoadMore } = props;
  const picker = useRef<HTMLInputElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  // the next page loads as the end of the grid comes near
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore || loadingMore) return;
    const observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && onLoadMore(), { rootMargin: "600px 0px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadMore]);

  return (
    <>
      <Reveal className="flex flex-col gap-5 pb-8">
        <RevealItem className="flex flex-col gap-1">
          <Link href={back.href} className="flex w-fit items-center gap-0.5 text-callout text-accent-ink">
            <ChevronLeftIcon aria-hidden className="size-4" />
            {back.label}
          </Link>
          <ScreenHeader
            title="Gallery"
            actions={
              <>
                <IconButton label="Upload photos and videos" variant="ink" disabled={props.uploading} onClick={() => picker.current?.click()}>
                  <UploadIcon />
                </IconButton>
                <input
                  ref={picker}
                  type="file"
                  accept="image/*,video/*,.heic,.heif"
                  multiple
                  hidden
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    e.target.value = "";
                    if (files.length) props.onUpload(files);
                  }}
                />
              </>
            }
          />
        </RevealItem>

        <RevealItem className="flex flex-col gap-3">
          <TextField
            label="Search photos & videos"
            placeholder="Search photos & videos…"
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            icon={<SearchIcon aria-hidden />}
            trailing={
              query ? (
                <button type="button" aria-label="Clear the search" onClick={() => onQueryChange("")} className="text-ink-muted hover:text-ink">
                  <XIcon aria-hidden className="size-5" />
                </button>
              ) : null
            }
          />
          <div className="flex gap-2" role="group" aria-label="Show">
            {FILTERS.map((f) => (
              <PillButton key={f.value} selected={filter === f.value} onClick={() => onFilter(f.value)}>
                {f.label}
              </PillButton>
            ))}
          </div>
        </RevealItem>

        <InlineError>{props.error}</InlineError>

        {empty ? (
          <RevealItem>
            <EmptyState icon={<ImagesIcon aria-hidden />} title={empty.title} body={empty.body} />
          </RevealItem>
        ) : (
          months.map((m) => (
            <section key={m.key} aria-label={m.title} className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-body-strong">{m.title}</h2>
                <p className="text-caption text-ink-muted">{m.summary}</p>
              </div>
              <div className="grid grid-cols-3 gap-0.5 overflow-hidden rounded-card">
                {m.tiles.map((t) => (
                  <GalleryTile key={t.id} tile={t} onOpen={props.onOpen} onVisible={props.onThumbWanted} />
                ))}
              </div>
            </section>
          ))
        )}
        {hasMore ? (
          <div ref={sentinel} className="flex justify-center py-4">
            {loadingMore ? <LoaderCircleIcon aria-label="Loading more" className="size-6 animate-spin text-ink-muted" /> : null}
          </div>
        ) : null}
      </Reveal>

      <PhotoViewer {...props.viewer} />
      <UploadSheet {...props.uploadSheet} />
    </>
  );
}
