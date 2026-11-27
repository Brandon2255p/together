"use client";

import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";

/** Screen 4 while the Together loads: the close button, the two avatars, the invite card */
export function InviteSkeleton() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[440px] flex-col px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <SkeletonGroup label="Loading your invite…" className="flex flex-1 flex-col gap-6">
        <Skeleton className="size-11 rounded-full" />
        <div className="flex justify-center -space-x-4 pt-2">
          <Skeleton className="size-[84px] rounded-full" />
          <Skeleton className="size-[84px] rounded-full" delay={0.1} />
        </div>
        <div className="flex flex-col items-center gap-2">
          <Skeleton className="h-10 w-3/4 rounded-2xl" delay={0.15} />
          <Skeleton className="h-4 w-2/3 rounded-full" delay={0.2} />
        </div>
        <Skeleton className="h-40 rounded-card" delay={0.25} />
        <Skeleton className="mt-auto h-12 rounded-full" delay={0.3} />
      </SkeletonGroup>
    </main>
  );
}

/** Screen 5 while the invite is checked: the members, "You're invited to", the name, the buttons */
export function JoinSkeleton() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[440px] flex-col px-5 pt-[max(3rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <SkeletonGroup label="Checking the invite…" className="flex flex-1 flex-col gap-6">
        <div className="flex flex-col items-center gap-4 pt-24">
          <div className="flex -space-x-3">
            <Skeleton className="size-14 rounded-full" />
            <Skeleton className="size-14 rounded-full" delay={0.1} />
          </div>
          <Skeleton className="h-3.5 w-28 rounded-full" delay={0.15} />
          <Skeleton className="h-12 w-3/4 rounded-2xl" delay={0.2} />
        </div>
        <div className="mt-auto flex flex-col gap-3">
          <Skeleton className="h-12 rounded-full" delay={0.25} />
          <Skeleton className="h-12 rounded-full" delay={0.3} />
        </div>
      </SkeletonGroup>
    </main>
  );
}
