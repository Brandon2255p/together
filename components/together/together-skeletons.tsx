"use client";

import { motion, useReducedMotion } from "motion/react";
import { Orb } from "@/components/ui/orb";
import { ScreenHeader } from "@/components/ui/layout";
import { Skeleton, SkeletonGroup, SkeletonRow } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** where the placeholder bubbles sit in screen 17's scene area: a big one and two smaller, like a real cluster */
const MIST_BUBBLES = [
  { className: "top-[14%] left-1/2 size-52 -translate-x-1/2", speed: 0.6 },
  { className: "bottom-[10%] left-[6%] size-36", speed: 0.8 },
  { className: "bottom-[16%] right-[8%] size-28", speed: 1 },
];

/** A grey 3D orb that breathes: the bubbles' shape, before we know their colours */
function MistOrb({ className, speed, delay = 0 }: { className?: string; speed: number; delay?: number }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      aria-hidden
      className={cn("absolute", className)}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={reduced ? { opacity: 1, scale: 1 } : { opacity: [0.7, 1, 0.7], scale: 1 }}
      transition={
        reduced
          ? { duration: 0.2 }
          : { opacity: { duration: 1.8, repeat: Infinity, ease: "easeInOut", delay }, scale: { duration: 0.4, delay } }
      }
    >
      <Orb palette="mist" blur={false} speed={speed} className="size-full" />
    </motion.div>
  );
}

/** Screen 17 while your Togethers load: the real title, and grey orbs where the bubbles will be */
export function TogethersSkeleton() {
  return (
    <SkeletonGroup label="Loading your Togethers…" className="flex flex-col gap-5">
      <Skeleton className="size-11 rounded-full" />
      <ScreenHeader eyebrow={<Skeleton className="inline-block h-3.5 w-20 rounded-full align-middle" />} title="Your Togethers" />
      <Skeleton className="-mt-3 h-4 w-4/5 rounded-full" />
      <div className="relative -mx-5 h-[min(62dvh,520px)]">
        {MIST_BUBBLES.map((b, i) => (
          <MistOrb key={i} className={b.className} speed={b.speed} delay={i * 0.15} />
        ))}
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-11 flex-1 rounded-full" />
        <Skeleton className="h-11 flex-1 rounded-full" delay={0.1} />
      </div>
    </SkeletonGroup>
  );
}

/** Screen 14 while the Together loads: header, member rows, and the invite card with a grey orb behind it */
export function TogetherSkeleton() {
  return (
    <SkeletonGroup label="Loading your Together…" className="flex flex-col gap-5">
      <Skeleton className="size-11 rounded-full" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3.5 w-16 rounded-full" />
        <Skeleton className="h-10 w-3/5 rounded-2xl" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3 w-20 rounded-full" />
        <SkeletonRow />
        <SkeletonRow delay={0.08} />
      </div>
      <div className="relative isolate flex h-52 flex-col items-center justify-center gap-3 overflow-hidden rounded-card bg-surface">
        <MistOrb className="-top-10 -right-10 -z-10 size-40" speed={0.7} />
        <Skeleton className="h-3 w-24 rounded-full" />
        <Skeleton className="h-11 w-48 rounded-2xl" delay={0.05} />
        <Skeleton className="h-3 w-28 rounded-full" delay={0.1} />
      </div>
    </SkeletonGroup>
  );
}

/**
 * Over screen 17 once a bubble is tapped, until Home has loaded: that Together's orb in its own colours, growing, so
 * the tap answers straight away.
 */
export function OpeningOverlay({ name, colors }: { name: string; colors: readonly [string, string, string] }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-bg/85 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        aria-hidden
        className="size-56"
        initial={{ scale: reduced ? 1 : 0.6 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 22 }}
      >
        <Orb colors={colors} blur={false} speed={1.4} className="size-full" />
      </motion.div>
      <p className="text-callout text-ink-muted">Opening {name}…</p>
    </motion.div>
  );
}
