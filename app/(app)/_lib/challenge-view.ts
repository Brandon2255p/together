import type { Route } from "next";
import type { Celebration, RecentPeriod } from "@/components/challenges/celebrations";
import type { ChallengeCardData } from "@/components/challenges/challenges-screen";
import type { ChipTone } from "@/components/ui/chip";
import { CADENCE_LABEL, BOOSTER_EVERY, MAX_BOOSTERS, nextPeriod, PERIOD_NOUN, type ChallengeSummary } from "@/lib/challenges/streak";
import { historyLabel, periods, rangeLabel, timeLeftLabel } from "@/lib/challenges/labels";
import type { Challenge, ChallengeCadence, DayKey, Member, Together } from "@/lib/models";

// Shapes challenges for the screens: shared by the Challenges list, a challenge, and Home. No IO.

export const CADENCE_TONE: Record<ChallengeCadence, ChipTone> = { daily: "accent", weekly: "partner", monthly: "warning" };

export const challengeHref = (id: string) => `/challenges/${id}` as Route;

export const membersOf = (challenge: Challenge, together: Together): Member[] =>
  challenge.memberIds.map((id) => together.members.find((m) => m.id === id) ?? together.formerMembers.find((m) => m.id === id)).filter((m): m is Member => !!m);

export function toCard(challenge: Challenge, summary: ChallengeSummary, together: Together): ChallengeCardData {
  return {
    id: challenge.id,
    href: challengeHref(challenge.id),
    title: challenge.title,
    cadence: CADENCE_LABEL[challenge.cadence],
    tone: CADENCE_TONE[challenge.cadence],
    streak: summary.streak,
    goalsDone: summary.current.goalsDone,
    goalsTotal: summary.current.goalsTotal,
    done: summary.current.done,
    upcoming: summary.current.upcoming,
    timeLeft: timeLeftLabel(challenge.cadence, summary.current),
    atRisk: summary.atRisk !== null,
    members: membersOf(challenge, together),
  };
}

const LAST: Record<ChallengeCadence, string> = { daily: "Yesterday", weekly: "Last week", monthly: "Last month" };
const LAST_LOWER: Record<ChallengeCadence, string> = { daily: "yesterday", weekly: "last week", monthly: "last month" };

/** "Yesterday slipped by" */
export const missedHeading = (cadence: ChallengeCadence) => `${LAST[cadence]} slipped by`;

/** "Last week · Mon 26 Oct – Sun 1 Nov" */
export const missedEyebrow = (cadence: ChallengeCadence, start: DayKey) => `${LAST[cadence]} · ${rangeLabel(cadence, start)}`;

/** "9-day streak" */
const streakOf = (cadence: ChallengeCadence, n: number) => `${n}-${PERIOD_NOUN[cadence]} streak`;

export function missedBody(cadence: ChallengeCadence, streak: number) {
  return `Use a booster and your ${streakOf(cadence, streak)} keeps going.`;
}

export function missedDeadline(cadence: ChallengeCadence, currentEnd: DayKey) {
  const by = cadence === "daily" ? "midnight" : cadence === "weekly" ? "Sunday" : rangeLabel("daily", currentEnd).replace(/^\w+ /, "");
  return `Decide by ${by}. After that the streak resets to 0.`;
}

/** the strip on the streak screen: the last few periods, this one lit, and the next one waiting */
function recentForStreak(cadence: ChallengeCadence, summary: ChallengeSummary): RecentPeriod[] {
  const ended = summary.history.slice(0, 4).reverse();
  const now = summary.current.start;
  return [
    ...ended.map((p) => ({ key: p.start, label: historyLabel(cadence, p.start), state: p.state })),
    { key: now, label: historyLabel(cadence, now), state: "now" as const },
    { key: "next", label: historyLabel(cadence, nextPeriod(cadence, now)), state: "next" as const },
  ];
}

/** the strip on the saved screen: the last few periods with the covered one lit, then this one */
function recentForSaved(cadence: ChallengeCadence, summary: ChallengeSummary): RecentPeriod[] {
  const ended = summary.history.slice(0, 5).reverse();
  return [
    ...ended.map((p) => ({ key: p.start, label: historyLabel(cadence, p.start), state: p.state })),
    { key: summary.current.start, label: historyLabel(cadence, summary.current.start), state: "next" as const },
  ];
}

/** what to show after the last goal of a period is ticked: done, the streak growing, and a booster when one was earned */
export function finishCelebrations(challenge: Challenge, before: ChallengeSummary, after: ChallengeSummary): Celebration[] {
  const { cadence, title } = challenge;
  const noun = PERIOD_NOUN[cadence];
  const total = after.current.goalsTotal;
  const early = cadence !== "daily" && after.current.daysLeft > 1 ? `, ${after.current.daysLeft - 1} ${after.current.daysLeft === 2 ? "day" : "days"} early` : "";
  const earned = after.boosters > before.boosters;
  const message =
    after.streak === 1
      ? `First ${noun} done. Every streak starts here.`
      : after.streak >= after.best
        ? `New best! ${periods(cadence, after.streak)} in a row.`
        : `${periods(cadence, after.streak)} in a row. Your best is ${after.best}.`;

  const list: Celebration[] = [
    {
      kind: "complete",
      heading: `${noun[0]!.toUpperCase()}${noun.slice(1)} complete!`,
      detail: `${title} · ${total === 1 ? "the goal" : `all ${total} goals`}${early}`,
      goals: challenge.goals.map((g) => ({ title: g.title, progress: g.target === 1 ? "Done" : `${g.target}/${g.target}` })),
    },
    {
      kind: "streak",
      from: before.streak,
      to: after.streak,
      noun: `${noun} streak!`,
      recent: recentForStreak(cadence, after),
      message,
      booster: earned ? `Booster earned for ${BOOSTER_EVERY} in a row` : null,
    },
  ];
  if (earned) {
    list.push({
      kind: "booster",
      heading: "You earned a booster!",
      message: `${periods(cadence, BOOSTER_EVERY)} in a row on ${title}. A booster covers one missed ${noun}.`,
      held: after.boosters,
      max: MAX_BOOSTERS,
    });
  }
  return list;
}

export function savedCelebration(challenge: Challenge, after: ChallengeSummary): Celebration {
  return {
    kind: "saved",
    message: `Your booster covered ${LAST_LOWER[challenge.cadence]}. ${challenge.title} is still on ${periods(challenge.cadence, after.streak)}.`,
    recent: recentForSaved(challenge.cadence, after),
    held: after.boosters,
    max: MAX_BOOSTERS,
  };
}
