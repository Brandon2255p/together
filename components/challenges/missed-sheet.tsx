"use client";

import { motion } from "motion/react";
import { BoosterShield, Flame } from "@/components/challenges/art";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/layout";
import { Sheet } from "@/components/ui/sheet";

export interface MissedSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "Last week · Mon 26 Oct – Sun 1 Nov" */
  eyebrow: string;
  /** "Last week slipped by" */
  heading: string;
  /** "Use a booster and your 12-week streak keeps going." */
  body: string;
  boosters: number;
  /** "Decide by Sunday — after that the streak resets to 0." */
  deadline: string;
  onUseBooster: () => void;
  onReset: () => void;
  pending: boolean;
  error: string | null;
}

/** Offered when the period just ended was missed and a booster can still cover it */
export function MissedSheet({ open, onOpenChange, eyebrow, heading, body, boosters, deadline, onUseBooster, onReset, pending, error }: MissedSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} eyebrow={eyebrow} title={heading}>
      <div className="flex flex-col gap-5">
        <div className="relative mx-auto grid h-28 w-32 place-items-center">
          <span aria-hidden className="absolute inset-0 rounded-full bg-[radial-gradient(circle,var(--color-partner-soft)_0%,transparent_70%)]" />
          <motion.div className="relative h-24 w-20 origin-bottom" animate={{ scale: [1, 0.93, 1] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}>
            <Flame cold className="h-full w-full" />
          </motion.div>
          <motion.span
            className="absolute right-0 bottom-0 grid size-11 place-items-center rounded-full bg-surface shadow-float"
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1, 1.1, 1] }}
            transition={{ delay: 0.35, duration: 1.2, times: [0, 0.35, 0.7, 1] }}
          >
            <BoosterShield className="h-7 w-6" />
          </motion.span>
        </div>
        <p className="text-center text-body text-ink-muted">{body}</p>
        <p className="mx-auto flex items-center gap-1.5 rounded-full bg-partner-soft py-1 pr-3 pl-2 text-caption font-semibold text-partner-ink">
          <BoosterShield className="h-4 w-3.5" />
          {boosters === 1 ? "1 booster left" : `${boosters} boosters left`}
        </p>
        <InlineError>{error}</InlineError>
        <div className="flex flex-col gap-2">
          <Button block pending={pending} onClick={onUseBooster} className="bg-linear-to-r from-[#8F9BFF] to-[#5563F0] text-on-accent shadow-float hover:bg-transparent">
            <BoosterShield className="h-5 w-4" />
            Use a booster
          </Button>
          <Button variant="ghost" block disabled={pending} onClick={onReset}>
            Let the streak reset
          </Button>
        </div>
        <p className="text-center text-caption text-ink-subtle">{deadline}</p>
      </div>
    </Sheet>
  );
}
