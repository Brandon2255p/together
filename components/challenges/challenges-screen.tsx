"use client";

import Link from "next/link";
import type { Route } from "next";
import { AnimatePresence, motion } from "motion/react";
import { CheckIcon, ChevronLeftIcon, PlusIcon, TrophyIcon } from "lucide-react";
import type { Member } from "@/lib/models";
import { BoosterShield, Flame } from "@/components/challenges/art";
import { NewChallengeSheet, type NewChallengeSheetProps } from "@/components/challenges/new-challenge-sheet";
import { AvatarStack } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Chip, type ChipTone } from "@/components/ui/chip";
import { iconButtonVariants } from "@/components/ui/icon-button";
import { EmptyState, InlineError, ScreenHeader, SectionHeader } from "@/components/ui/layout";
import { ListItem, Reveal, RevealItem } from "@/components/ui/motion";
import { cn } from "@/lib/utils";

export interface ChallengeCardData {
  id: string;
  href: Route;
  title: string;
  cadence: string;
  tone: ChipTone;
  streak: number;
  goalsDone: number;
  goalsTotal: number;
  done: boolean;
  upcoming: boolean;
  /** "4 days left", "Ends tonight", "Starts Mon 9 Nov" */
  timeLeft: string;
  /** last period was missed and a booster can save it */
  atRisk: boolean;
  members: Member[];
}

export interface ChallengesScreenProps {
  back: Route;
  /** the longest streak going, for the dark card at the top */
  hero: { streak: number; noun: string; title: string; boosters: number } | null;
  challenges: ChallengeCardData[];
  onNew: () => void;
  sheet: NewChallengeSheetProps;
  error: string | null;
}

/** The orange-to-coral bar (green once done) that fills when it first shows and when it moves */
export function StreakBar({ value, done, label, className }: { value: number; done: boolean; label: string; className?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn("relative h-2.5 overflow-hidden rounded-full bg-surface-muted", className)}
    >
      <motion.div
        className={cn("relative h-full rounded-full", done ? "bg-linear-to-r from-[#3FC488] to-success" : "bg-linear-to-r from-[#FFB238] to-accent")}
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(pct, pct > 0 ? 4 : 0)}%` }}
        transition={{ type: "spring", stiffness: 70, damping: 16, delay: 0.1 }}
      >
        <span className="absolute inset-x-1 top-0.5 h-[3px] rounded-full bg-white/35" />
      </motion.div>
    </div>
  );
}

/** "🔥 12" */
export function StreakPill({ streak, warm, className }: { streak: number; warm?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full py-1 pr-2.5 pl-2 text-body-strong", warm ? "bg-warning-soft text-warning-ink" : "bg-surface-muted", className)}>
      <Flame className="h-4 w-3.5" cold={streak === 0} />
      {streak}
    </span>
  );
}

function ChallengeCard({ c }: { c: ChallengeCardData }) {
  return (
    <Link href={c.href} className="flex flex-col gap-3 rounded-3xl bg-surface p-4 shadow-card transition-transform active:scale-[0.99]">
      <span className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 flex-col gap-2">
          <span className="truncate text-body-strong">{c.title}</span>
          <span className="flex items-center gap-2">
            <Chip tone={c.tone}>{c.cadence}</Chip>
            {c.members.length > 1 ? <AvatarStack members={c.members} size="sm" /> : null}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-2">
          <StreakPill streak={c.streak} warm={c.done} />
          <span className={cn("text-caption", c.done ? "text-success-ink" : c.atRisk ? "text-partner-ink" : "text-ink-muted")}>
            {c.atRisk ? "Streak at risk" : c.timeLeft}
          </span>
        </span>
      </span>
      <span className="flex items-center gap-3">
        <StreakBar value={c.goalsTotal ? c.goalsDone / c.goalsTotal : 0} done={c.done} label={`${c.title}: ${c.goalsDone} of ${c.goalsTotal} goals`} className="flex-1" />
        {c.done ? (
          <span className="grid size-6 place-items-center rounded-full bg-success text-on-accent">
            <CheckIcon className="size-4" strokeWidth={3} aria-hidden />
          </span>
        ) : (
          <span className="w-8 text-right text-caption font-semibold text-ink-muted">
            {c.goalsDone}/{c.goalsTotal}
          </span>
        )}
      </span>
    </Link>
  );
}

export function ChallengesScreen({ back, hero, challenges, onNew, sheet, error }: ChallengesScreenProps) {
  return (
    <Reveal className="flex flex-col gap-5">
      <RevealItem className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Link href={back} aria-label="Back to Home" className={iconButtonVariants({ variant: "surface" })}>
            <ChevronLeftIcon aria-hidden />
          </Link>
          <button type="button" aria-label="New challenge" onClick={onNew} className={iconButtonVariants({ variant: "ink" })}>
            <PlusIcon aria-hidden />
          </button>
        </div>
        <ScreenHeader title="Challenges" />
      </RevealItem>

      {hero ? (
        <RevealItem>
          <div className="relative isolate flex items-center justify-between overflow-hidden rounded-card bg-ink p-5 text-on-accent">
            <span
              aria-hidden
              className="absolute -top-16 -right-10 -z-10 size-64 rounded-full bg-[radial-gradient(circle,rgb(255_138_61/0.75)_0%,rgb(255_107_74/0.18)_55%,transparent_70%)]"
            />
            <span className="flex min-w-0 flex-col gap-1">
              <span className="text-overline text-ink-subtle">Longest streak going</span>
              <span className="font-display text-[64px] leading-[64px]">{hero.streak}</span>
              <span className="truncate text-callout text-white/75">
                {hero.noun} in a row · {hero.title}
              </span>
              {hero.boosters ? (
                <span className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/12 py-1 pr-2.5 pl-1.5 text-caption">
                  <BoosterShield className="h-4 w-3.5" />
                  {hero.boosters} {hero.boosters === 1 ? "booster" : "boosters"} saved
                </span>
              ) : null}
            </span>
            <Flame flicker className="h-28 w-[88px] shrink-0" />
          </div>
        </RevealItem>
      ) : null}

      <RevealItem className="flex flex-col gap-3">
        <InlineError>{error}</InlineError>
        {challenges.length ? (
          <>
            <SectionHeader title="This period" />
            <ul className="flex flex-col gap-3">
              <AnimatePresence initial={false}>
                {challenges.map((c) => (
                  <ListItem key={c.id}>
                    <ChallengeCard c={c} />
                  </ListItem>
                ))}
              </AnimatePresence>
            </ul>
          </>
        ) : (
          <EmptyState
            icon={<TrophyIcon aria-hidden />}
            title="No challenges yet"
            body="Set a few goals for a day, a week or a month. Hit them all and your streak grows."
            action={<Button onClick={onNew}>New challenge</Button>}
          />
        )}
      </RevealItem>
      <NewChallengeSheet {...sheet} />
    </Reveal>
  );
}
