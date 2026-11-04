"use client";

import { motion, useReducedMotion } from "motion/react";
import { ScreenHeader } from "@/components/ui/layout";
import { cn } from "@/lib/utils";

/**
 * A placeholder block that breathes while something loads. Give it the size and radius of what it stands in for.
 * Hidden from assistive tech: wrap a group of them in <SkeletonGroup label="…"> so screen readers hear one "Loading…".
 */
export function Skeleton({ className, delay = 0 }: { className?: string; delay?: number }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      aria-hidden
      className={cn("rounded-row bg-surface-muted", className)}
      initial={{ opacity: 0.6 }}
      animate={reduced ? { opacity: 0.8 } : { opacity: [0.6, 1, 0.6] }}
      transition={reduced ? undefined : { duration: 1.6, repeat: Infinity, ease: "easeInOut", delay }}
    />
  );
}

export function SkeletonGroup({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** A list row: a round thumb, a line and a shorter line under it */
export function SkeletonRow({ delay = 0, className }: { delay?: number; className?: string }) {
  return (
    <div aria-hidden className={cn("flex items-center gap-3.5 rounded-3xl bg-surface p-3 pr-4", className)}>
      <Skeleton className="size-12 shrink-0 rounded-full" delay={delay} />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-3/5 rounded-full" delay={delay} />
        <Skeleton className="h-3 w-2/5 rounded-full" delay={delay + 0.1} />
      </div>
    </div>
  );
}

/**
 * What a tab shows the moment you tap it, while its data loads: the real title, then placeholders shaped like the
 * screen (a segmented control, a card, rows).
 */
export function ScreenSkeleton({
  title,
  segmented = false,
  card = false,
  rows = 4,
}: {
  /** the screen's title; leave it out when it depends on the data (home's greeting) */
  title?: string;
  segmented?: boolean;
  /** a big card above the rows (home's "Up next", the calendar's month) */
  card?: boolean;
  rows?: number;
}) {
  return (
    <SkeletonGroup label={title ? `Loading ${title.toLowerCase()}…` : "Loading…"} className="flex flex-col gap-5">
      {title ? (
        <ScreenHeader title={title} />
      ) : (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-28 rounded-full" />
          <Skeleton className="h-10 w-3/5 rounded-2xl" />
        </div>
      )}
      {segmented ? <Skeleton className="h-12 rounded-full" /> : null}
      {card ? <Skeleton className="h-56 rounded-card" delay={0.05} /> : null}
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: rows }, (_, i) => (
          <SkeletonRow key={i} delay={0.1 + i * 0.08} />
        ))}
      </div>
    </SkeletonGroup>
  );
}
