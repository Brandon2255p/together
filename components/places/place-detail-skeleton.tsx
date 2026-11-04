"use client";

import { MapPinIcon } from "lucide-react";
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";

/** The place screen's shape while it loads: the hero, the title and chips, the two ratings, the Maps row */
export function PlaceDetailSkeleton() {
  return (
    <SkeletonGroup label="Loading the place…" className="-mx-5 -mt-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="grid h-[300px] place-items-center bg-surface-muted text-ink-subtle">
        <MapPinIcon className="size-14" strokeWidth={1.5} aria-hidden />
      </div>
      <div className="relative -mt-8 flex flex-col gap-5 rounded-t-sheet bg-bg px-5 pt-6">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10 w-2/3 rounded-2xl" />
          <div className="flex gap-1.5">
            <Skeleton className="h-8 w-24 rounded-full" delay={0.05} />
            <Skeleton className="h-8 w-32 rounded-full" delay={0.1} />
          </div>
        </div>
        <div className="flex gap-2.5">
          <Skeleton className="h-16 flex-1" delay={0.15} />
          <Skeleton className="h-16 flex-1" delay={0.2} />
        </div>
        <Skeleton className="h-14" delay={0.25} />
      </div>
    </SkeletonGroup>
  );
}
