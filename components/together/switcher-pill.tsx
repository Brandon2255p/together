"use client";

import Link from "next/link";
import type { Route } from "next";
import { motion } from "motion/react";
import { ChevronDownIcon } from "lucide-react";
import type { MemberTone } from "@/lib/models";
import { TONE_BG } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/**
 * Screen 18: the pill on the Home header naming the current Together. Opens your Togethers (17).
 * The dot means something new happened in one of your other Togethers.
 */
export function SwitcherPill({
  name,
  tone,
  hasNews,
  href,
  className,
}: {
  name: string;
  tone: MemberTone;
  hasNews: boolean;
  href: Route;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={hasNews ? `${name}. Switch Together, there's something new in another one` : `${name}. Switch Together`}
      className={cn(
        "relative inline-flex max-w-full items-center gap-2 rounded-chip border border-line bg-surface py-1.5 pr-3 pl-2 text-caption text-ink transition-transform active:scale-[0.97]",
        className
      )}
    >
      <span className={cn("size-3 shrink-0 rounded-full", TONE_BG[tone])} aria-hidden />
      <span className="truncate font-semibold">{name}</span>
      <ChevronDownIcon className="size-3.5 shrink-0 text-ink-muted" aria-hidden />
      {hasNews ? (
        <motion.span
          aria-hidden
          className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-accent ring-2 ring-bg"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 20 }}
        />
      ) : null}
    </Link>
  );
}
