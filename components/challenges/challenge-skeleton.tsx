"use client";

import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";

/** A challenge's shape while it loads: back button, cadence chip, title, the streak card, the goals */
export function ChallengeSkeleton() {
  return (
    <SkeletonGroup label="Loading the challenge…" className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Skeleton className="size-11 rounded-full" />
        <Skeleton className="h-7 w-20 rounded-full" />
        <Skeleton className="h-10 w-3/4 rounded-2xl" />
      </div>
      <Skeleton className="h-[188px] rounded-card" delay={0.05} />
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-4 w-28 rounded-full" delay={0.1} />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 rounded-3xl" delay={0.15 + i * 0.08} />
        ))}
      </div>
    </SkeletonGroup>
  );
}
