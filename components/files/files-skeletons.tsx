"use client";

import { ScreenHeader } from "@/components/ui/layout";
import { Skeleton, SkeletonGroup, SkeletonRow } from "@/components/ui/skeleton";

/** "‹ Home" (or "‹ Files"), the title (a placeholder when it comes from the data), and the round upload button */
function Header({ title }: { title?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <Skeleton className="h-4 w-16 rounded-full" />
      {title ? (
        <ScreenHeader title={title} actions={<Skeleton className="size-11 rounded-full" />} />
      ) : (
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-10 w-1/2 rounded-2xl" />
          <Skeleton className="size-11 rounded-full" />
        </div>
      )}
    </div>
  );
}

/** Screen 38 while the photos load: search, the filter pills, a month of tiles */
export function GallerySkeleton() {
  return (
    <SkeletonGroup label="Loading your photos…" className="flex flex-col gap-5">
      <Header title="Gallery" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-14 rounded-row" />
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-9 w-20 rounded-full" delay={i * 0.05} />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-32 rounded-full" delay={0.1} />
        <div className="grid grid-cols-3 gap-0.5 overflow-hidden rounded-card">
          {Array.from({ length: 12 }, (_, i) => (
            <Skeleton key={i} className="aspect-square rounded-none" delay={0.1 + (i % 3) * 0.05 + Math.floor(i / 3) * 0.08} />
          ))}
        </div>
      </div>
    </SkeletonGroup>
  );
}

/** Screens 39 and 40 while the documents load: search, folders, rows. A folder's name isn't known yet. */
export function DocumentsSkeleton({ title }: { title?: string }) {
  return (
    <SkeletonGroup label={`Loading ${title ? title.toLowerCase() : "the folder"}…`} className="flex flex-col gap-5">
      <Header title={title} />
      <Skeleton className="h-14 rounded-row" />
      {title ? (
        <div className="grid grid-cols-2 gap-2.5">
          <Skeleton className="h-[72px] rounded-card" delay={0.05} />
          <Skeleton className="h-[72px] rounded-card" delay={0.1} />
        </div>
      ) : null}
      <div className="flex flex-col gap-2.5">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonRow key={i} delay={0.15 + i * 0.08} />
        ))}
      </div>
    </SkeletonGroup>
  );
}
