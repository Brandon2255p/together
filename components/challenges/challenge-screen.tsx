"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { AnimatePresence, motion } from "motion/react";
import { CheckIcon, ChevronLeftIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import type { Member } from "@/lib/models";
import { BoosterShield, Flame, Sparkle } from "@/components/challenges/art";
import { CelebrationOverlay, type Celebration } from "@/components/challenges/celebrations";
import { StreakBar } from "@/components/challenges/challenges-screen";
import { MissedSheet, type MissedSheetProps } from "@/components/challenges/missed-sheet";
import { AvatarStack } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Chip, type ChipTone } from "@/components/ui/chip";
import { iconButtonVariants } from "@/components/ui/icon-button";
import { InlineError, SectionHeader } from "@/components/ui/layout";
import { Reveal, RevealItem } from "@/components/ui/motion";
import { cn } from "@/lib/utils";

export interface GoalRowData {
  id: string;
  title: string;
  /** "3× this week" */
  detail: string;
  target: number;
  count: number;
  done: boolean;
  /** the challenge hasn't started */
  locked: boolean;
}

export interface ChallengeScreenProps {
  back: Route;
  title: string;
  cadence: string;
  tone: ChipTone;
  members: Member[];
  streak: number;
  /** "week streak" */
  streakNoun: string;
  /** "Your best yet" / "Best: 14" */
  bestLine: string;
  boosters: { held: number; max: number; toNext: number; every: number };
  period: { label: string; range: string; left: string; done: boolean; upcoming: boolean; goalsDone: number; goalsTotal: number };
  goals: GoalRowData[];
  onCountChange: (goalId: string, count: number) => void;
  /** "Past weeks" */
  historyTitle: string;
  /** ended periods, oldest first */
  history: { key: string; label: string; state: "done" | "boosted" | "missed" }[];
  /** "Pick up the booster offer" banner, when a missed period can still be saved */
  atRisk: string | null;
  onOpenMissed: () => void;
  missed: MissedSheetProps;
  celebration: Celebration | null;
  onCelebrationNext: () => void;
  onDelete: () => void;
  error: string | null;
}

/** the ring, rays and "+1" that burst from a goal's button as it's ticked */
function Burst({ done }: { done: boolean }) {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0">
      <motion.span
        className={cn("absolute inset-0 rounded-full border-[3px]", done ? "border-success" : "border-accent")}
        initial={{ scale: 0.5, opacity: 0.9 }}
        animate={{ scale: 1.9, opacity: 0 }}
        transition={{ duration: 0.55, ease: "easeOut" }}
      />
      {done
        ? Array.from({ length: 8 }, (_, i) => (
            <motion.span
              key={i}
              className={cn("absolute top-1/2 left-1/2 h-2.5 w-1 rounded-full", i % 2 ? "bg-[#FFB238]" : "bg-success")}
              style={{ rotate: `${i * 45}deg` }}
              initial={{ x: "-50%", y: "-50%", translateY: 0, opacity: 0 }}
              animate={{ translateY: [-14, -34], opacity: [0, 1, 0] }}
              transition={{ duration: 0.5, ease: "easeOut", delay: 0.05 }}
            />
          ))
        : null}
      <motion.span
        className={cn("absolute -top-7 left-1/2 -translate-x-1/2 text-title", done ? "text-success" : "text-accent")}
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: [12, 0, -14], opacity: [0, 1, 0] }}
        transition={{ duration: 1, times: [0, 0.35, 1] }}
      >
        +1
      </motion.span>
    </span>
  );
}

function GoalRow({ goal, onCountChange }: { goal: GoalRowData; onCountChange: (goalId: string, count: number) => void }) {
  // UI-only: replays the burst on each tap
  const [taps, setTaps] = useState(0);
  const single = goal.target === 1;
  const bump = (count: number) => {
    if (count > goal.count) setTaps((t) => t + 1);
    onCountChange(goal.id, count);
  };

  return (
    <div className={cn("flex items-center gap-3 rounded-row bg-surface py-3 pr-3 pl-4 shadow-card", goal.locked && "opacity-60")}>
      {single ? (
        <span className="relative">
          <Checkbox checked={goal.done} label={goal.title} onCheckedChange={(on) => !goal.locked && bump(on ? 1 : 0)} />
          <AnimatePresence>{taps && goal.done ? <Burst key={taps} done /> : null}</AnimatePresence>
        </span>
      ) : (
        <button
          type="button"
          aria-label={`${goal.title}: ${goal.count} of ${goal.target}. Take one off`}
          disabled={goal.locked || goal.count === 0}
          onClick={() => bump(goal.count - 1)}
          className={cn("grid size-8 shrink-0 place-items-center rounded-full text-body-strong transition-colors", goal.done ? "bg-success text-on-accent" : "bg-surface-muted")}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={goal.done ? "done" : goal.count} initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.3, opacity: 0 }} transition={{ type: "spring", stiffness: 500, damping: 22 }}>
              {goal.done ? <CheckIcon className="size-4" strokeWidth={3} aria-hidden /> : goal.count}
            </motion.span>
          </AnimatePresence>
        </button>
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn("truncate text-body-strong text-[15px] transition-colors", single && goal.done && "text-ink-subtle line-through")}>{goal.title}</span>
        <span className="text-caption text-ink-muted">{goal.detail}</span>
      </span>
      {!single ? (
        <>
          <span className="flex max-w-24 flex-wrap justify-end gap-1" aria-hidden>
            {Array.from({ length: Math.min(goal.target, 10) }, (_, i) => (
              <motion.span
                key={i}
                className={cn("size-[7px] rounded-full", i < goal.count ? (goal.done ? "bg-success" : "bg-accent") : "bg-line")}
                animate={i === goal.count - 1 ? { scale: [1, 1.8, 1] } : { scale: 1 }}
                transition={{ duration: 0.35 }}
              />
            ))}
          </span>
          <motion.button
            type="button"
            aria-label={`Add one to ${goal.title}`}
            disabled={goal.locked || goal.done}
            onClick={() => bump(goal.count + 1)}
            whileTap={{ scale: 0.82 }}
            className={cn(
              "relative grid size-10 shrink-0 place-items-center rounded-full transition-colors disabled:cursor-default",
              goal.done ? "bg-success-soft text-success-ink" : "bg-ink text-on-accent"
            )}
          >
            {goal.done ? <CheckIcon className="size-5" aria-hidden /> : <PlusIcon className="size-5" aria-hidden />}
            <AnimatePresence>{taps ? <Burst key={taps} done={goal.done} /> : null}</AnimatePresence>
          </motion.button>
        </>
      ) : null}
    </div>
  );
}

export function ChallengeScreen(props: ChallengeScreenProps) {
  const { back, title, cadence, tone, members, streak, streakNoun, bestLine, boosters, period, goals, onCountChange, historyTitle, history, atRisk, onOpenMissed, missed, celebration, onCelebrationNext, onDelete, error } = props;
  // UI-only: Delete asks once more
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const pips = boosters.every - boosters.toNext;

  return (
    <Reveal className="flex flex-col gap-5">
      <RevealItem className="flex flex-col gap-3">
        <Link href={back} aria-label="Back to challenges" className={iconButtonVariants({ variant: "surface" })}>
          <ChevronLeftIcon aria-hidden />
        </Link>
        <span className="flex items-center justify-between gap-3">
          <Chip tone={tone}>{cadence}</Chip>
          {members.length > 1 ? <AvatarStack members={members} /> : null}
        </span>
        <h1 className="text-display-l text-balance">{title}</h1>
      </RevealItem>

      {atRisk ? (
        <RevealItem>
          <button
            type="button"
            onClick={onOpenMissed}
            className="flex w-full items-center gap-3 rounded-3xl bg-partner-soft p-4 text-left text-partner-ink transition-transform active:scale-[0.99]"
          >
            <BoosterShield className="h-9 w-8 shrink-0" />
            <span className="flex flex-col">
              <span className="text-body-strong">{atRisk}</span>
              <span className="text-caption">Use a booster to keep your streak</span>
            </span>
          </button>
        </RevealItem>
      ) : null}

      <RevealItem>
        <div className="relative overflow-hidden rounded-card bg-linear-to-br from-[#FFF4E6] to-[#FFE5DC] p-5">
          <span aria-hidden className="absolute -top-2 -left-2 size-36 rounded-full bg-[radial-gradient(circle,rgb(255_194_74/0.45)_0%,transparent_70%)]" />
          <div className="relative flex items-center gap-4">
            <Flame flicker={streak > 0} cold={streak === 0} className="h-[90px] w-[72px] shrink-0" />
            <div className="flex flex-col">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={streak}
                  className="font-display text-[64px] leading-[64px]"
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -30, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 18 }}
                >
                  {streak}
                </motion.span>
              </AnimatePresence>
              <span className="text-body-strong text-warning-ink">{streakNoun}</span>
              <span className="text-caption text-warning-ink/70">{bestLine}</span>
            </div>
          </div>
          <div className="relative mt-4 flex items-center justify-between gap-3 border-t border-warning/20 pt-3">
            <span className="flex items-center gap-2">
              <span className="flex -space-x-1">
                {Array.from({ length: boosters.max }, (_, i) => (
                  <BoosterShield key={i} empty={i >= boosters.held} className="h-6 w-5" />
                ))}
              </span>
              <span className="text-caption font-semibold text-partner-ink">
                {boosters.held === 1 ? "1 booster" : `${boosters.held} boosters`}
              </span>
            </span>
            <span className="flex items-center gap-2 text-caption text-warning-ink" title={`A booster for every ${boosters.every} in a row`}>
              {boosters.held >= boosters.max ? "Booster slots full" : `Next in ${boosters.toNext}`}
              <span className="flex gap-1" aria-hidden>
                {Array.from({ length: boosters.every }, (_, i) => (
                  <motion.span key={i} className={cn("size-2 rounded-full", i < pips ? "bg-warning" : "bg-white/90")} animate={i === pips - 1 ? { scale: [1, 1.6, 1] } : undefined} />
                ))}
              </span>
            </span>
          </div>
        </div>
      </RevealItem>

      <RevealItem>
        <div className={cn("relative flex flex-col gap-3 rounded-3xl bg-surface p-4 shadow-card transition-shadow duration-500", period.done && "shadow-[0_0_0_2px_var(--color-success),0_6px_24px_rgb(47_165_114/0.28)]")}>
          <span className="flex items-baseline justify-between gap-3">
            <span className="text-body-strong">{period.label}</span>
            <span className={cn("truncate text-caption", period.done ? "text-success-ink" : "text-ink-muted")}>
              {period.range} · {period.left}
            </span>
          </span>
          <span className="flex items-center gap-3">
            <StreakBar value={period.goalsTotal ? period.goalsDone / period.goalsTotal : 0} done={period.done} label={`${period.goalsDone} of ${period.goalsTotal} goals done`} className="h-3.5 flex-1" />
            <motion.span key={period.goalsDone} className={cn("text-callout font-semibold", period.done && "text-success-ink")} initial={{ scale: 1.3 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 15 }}>
              {period.goalsDone}/{period.goalsTotal}
            </motion.span>
          </span>
          <AnimatePresence>
            {period.done ? (
              <motion.span
                className="absolute -top-3.5 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-success py-1 pr-3 pl-2 text-caption font-semibold whitespace-nowrap text-on-accent shadow-float"
                initial={{ scale: 0, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 16, delay: 0.3 }}
              >
                <CheckIcon className="size-4" strokeWidth={3} aria-hidden />
                All goals done
                <Sparkle className="-top-2 -right-3 size-3.5 text-[#FFB238]" delay={0.5} />
              </motion.span>
            ) : null}
          </AnimatePresence>
        </div>
      </RevealItem>

      <RevealItem className="flex flex-col gap-3">
        <SectionHeader title="Goals" />
        <InlineError>{error}</InlineError>
        <ul className="flex flex-col gap-2">
          {goals.map((g) => (
            <li key={g.id}>
              <GoalRow goal={g} onCountChange={onCountChange} />
            </li>
          ))}
        </ul>
      </RevealItem>

      {history.length ? (
        <RevealItem className="flex flex-col gap-3">
          <SectionHeader title={historyTitle} />
          <ol className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            {history.map((p) => (
              <li key={p.key} className="flex shrink-0 flex-col items-center gap-1">
                <span
                  className={cn(
                    "grid size-9 place-items-center rounded-full",
                    p.state === "done" ? "bg-success text-on-accent" : p.state === "boosted" ? "bg-partner-soft" : "bg-surface-muted text-ink-subtle"
                  )}
                  title={p.state === "done" ? "Done" : p.state === "boosted" ? "Saved by a booster" : "Missed"}
                >
                  {p.state === "done" ? <CheckIcon className="size-5" aria-label="Done" /> : null}
                  {p.state === "boosted" ? <BoosterShield className="h-5 w-4" /> : null}
                  {p.state === "missed" ? <XIcon className="size-4" aria-label="Missed" /> : null}
                </span>
                <span className="text-[11px] text-ink-muted">{p.label}</span>
              </li>
            ))}
          </ol>
        </RevealItem>
      ) : null}

      <RevealItem>
        {confirmingDelete ? (
          <div className="flex flex-col gap-2">
            <p className="text-center text-caption text-ink-muted">Delete it and its streak for everyone? This can&apos;t be undone.</p>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setConfirmingDelete(false)}>
                Keep it
              </Button>
              <Button variant="accent" className="flex-1" onClick={onDelete}>
                Delete
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" block className="text-accent-ink" onClick={() => setConfirmingDelete(true)}>
            <Trash2Icon className="size-4" aria-hidden />
            Delete challenge
          </Button>
        )}
      </RevealItem>

      <MissedSheet {...missed} />
      <CelebrationOverlay celebration={celebration} onNext={onCelebrationNext} />
    </Reveal>
  );
}
