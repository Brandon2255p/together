"use client";

import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";

/**
 * A place form's shape while it loads (21a search, 21b/c the form, 22 edit): the close/back button and title, then
 * either the search box or the form's fields, and the button at the bottom.
 */
export function PlaceFormSkeleton({ title, search = false }: { title?: string; search?: boolean }) {
  return (
    <SkeletonGroup label={`Loading ${title ? title.toLowerCase() : "the place"}…`} className="flex min-h-[calc(100dvh-3rem)] flex-col gap-5">
      <header className="flex items-center gap-3">
        <Skeleton className="size-11 rounded-full" />
        {title ? <h1 className="text-title">{title}</h1> : <Skeleton className="h-7 w-40 rounded-full" />}
      </header>
      {search ? (
        <Skeleton className="h-14 rounded-row" delay={0.05} />
      ) : (
        <>
          <Skeleton className="h-14 rounded-row" delay={0.05} />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3.5 w-12 rounded-full" delay={0.1} />
            <Skeleton className="h-12 rounded-full" delay={0.1} />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3.5 w-16 rounded-full" delay={0.15} />
            <Skeleton className="h-28 rounded-row" delay={0.15} />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3.5 w-14 rounded-full" delay={0.2} />
            <Skeleton className="h-12 rounded-full" delay={0.2} />
          </div>
        </>
      )}
      <Skeleton className="mt-auto mb-2 h-12 rounded-full" delay={0.25} />
    </SkeletonGroup>
  );
}
