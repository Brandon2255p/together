import { addDays, dayDate, diffDays, toKey } from "@/lib/format";
import type { Challenge, ChallengeCadence, ChallengeGoal, DayKey } from "@/lib/models";

// Challenge periods, streaks and boosters. Pure: the stub, Supabase and the screens all work them out from a
// challenge's period outcomes (done / boosted / reset), so every layer agrees.

/** a booster is earned for every this-many periods done in a row */
export const BOOSTER_EVERY = 5;
/** the most boosters a challenge can hold */
export const MAX_BOOSTERS = 3;

/** the first day of the period `day` falls in: the day itself, its Monday, or the 1st */
export function periodStartOf(cadence: ChallengeCadence, day: DayKey): DayKey {
  if (cadence === "daily") return day;
  if (cadence === "monthly") return `${day.slice(0, 7)}-01`;
  // getUTCDay: Sunday 0 … Saturday 6; Monday is 0 days back, Sunday 6
  const back = (dayDate(day).getUTCDay() + 6) % 7;
  return addDays(day, -back);
}

export function nextPeriod(cadence: ChallengeCadence, start: DayKey): DayKey {
  if (cadence === "daily") return addDays(start, 1);
  if (cadence === "weekly") return addDays(start, 7);
  const d = dayDate(start);
  d.setUTCMonth(d.getUTCMonth() + 1, 1);
  return toKey(d);
}

export function previousPeriod(cadence: ChallengeCadence, start: DayKey): DayKey {
  if (cadence === "daily") return addDays(start, -1);
  if (cadence === "weekly") return addDays(start, -7);
  const d = dayDate(start);
  d.setUTCMonth(d.getUTCMonth() - 1, 1);
  return toKey(d);
}

/** the period's last day */
export function periodEnd(cadence: ChallengeCadence, start: DayKey): DayKey {
  return addDays(nextPeriod(cadence, start), -1);
}

/** when a new challenge can start: the period today is in, or the next one */
export function startOptions(cadence: ChallengeCadence, today: DayKey): { now: DayKey; next: DayKey } {
  const now = periodStartOf(cadence, today);
  return { now, next: nextPeriod(cadence, now) };
}

export const goalDone = (goal: Pick<ChallengeGoal, "count" | "target">) => goal.count >= goal.target;

/** every goal reached its target (a challenge with no goals is never done) */
export const allGoalsDone = (goals: Pick<ChallengeGoal, "count" | "target">[]) => goals.length > 0 && goals.every(goalDone);

/** an ended period, as the history row and the streak walk see it */
export type PeriodState = "done" | "boosted" | "missed";

export interface ChallengeSummary {
  current: {
    start: DayKey;
    end: DayKey;
    /** days left including today; 0 when it hasn't started */
    daysLeft: number;
    /** the challenge starts later: goals can't be ticked yet */
    upcoming: boolean;
    /** every goal is done this period */
    done: boolean;
    goalsDone: number;
    goalsTotal: number;
  };
  /** periods done in a row, counting this one once it's done. Boosted periods keep it going but don't add. */
  streak: number;
  best: number;
  /** held now, 0 to MAX_BOOSTERS */
  boosters: number;
  /** periods done in a row still needed for the next booster */
  toNextBooster: number;
  /**
   * The period just ended was missed, the streak before it is worth saving and there's a booster to save it with.
   * It stays open until the current period ends; after that the streak is gone.
   */
  atRisk: { start: DayKey; streak: number } | null;
  /** ended periods, newest first */
  history: { start: DayKey; state: PeriodState }[];
}

interface Run {
  streak: number;
  best: number;
  boosters: number;
  /** done periods towards the next booster */
  progress: number;
}

function addDone(run: Run): Run {
  const streak = run.streak + 1;
  const earned = run.progress + 1 >= BOOSTER_EVERY;
  return {
    streak,
    best: Math.max(run.best, streak),
    boosters: earned ? Math.min(MAX_BOOSTERS, run.boosters + 1) : run.boosters,
    progress: earned ? 0 : run.progress + 1,
  };
}

/** where a challenge stands today */
export function summarize(
  challenge: Pick<Challenge, "cadence" | "startsOn" | "periods" | "goals" | "periodStart">,
  today: DayKey,
): ChallengeSummary {
  const { cadence } = challenge;
  // always a period's first day, even if a bad date slipped in
  const startsOn = periodStartOf(cadence, challenge.startsOn);
  const upcoming = startsOn > today;
  const start = upcoming ? startsOn : periodStartOf(cadence, today);
  const end = periodEnd(cadence, start);
  const outcomes = new Map(challenge.periods.map((p) => [p.start, p.outcome]));
  // counts from an older period (a page left open over midnight) don't count towards this one
  const goals = challenge.periodStart === start ? challenge.goals : challenge.goals.map((g) => ({ ...g, count: 0 }));
  const done = !upcoming && allGoalsDone(goals);

  let run: Run = { streak: 0, best: 0, boosters: 0, progress: 0 };
  let atRisk: ChallengeSummary["atRisk"] = null;
  const history: ChallengeSummary["history"] = [];
  const last = previousPeriod(cadence, start);
  for (let p = startsOn; p <= last; p = nextPeriod(cadence, p)) {
    const outcome = outcomes.get(p);
    if (outcome === "done") {
      run = addDone(run);
      history.push({ start: p, state: "done" });
    } else if (outcome === "boosted") {
      run = { ...run, boosters: Math.max(0, run.boosters - 1) };
      history.push({ start: p, state: "boosted" });
    } else {
      history.push({ start: p, state: "missed" });
      if (p === last && outcome !== "reset" && run.streak > 0 && run.boosters > 0) atRisk = { start: p, streak: run.streak };
      else run = { ...run, streak: 0, progress: 0 };
    }
  }
  if (done) run = addDone(run);

  return {
    current: {
      start,
      end,
      daysLeft: upcoming ? 0 : diffDays(today, end) + 1,
      upcoming,
      done,
      goalsDone: goals.filter(goalDone).length,
      goalsTotal: goals.length,
    },
    streak: run.streak,
    best: run.best,
    boosters: run.boosters,
    toNextBooster: BOOSTER_EVERY - run.progress,
    atRisk,
    history: history.reverse(),
  };
}

export const CADENCE_LABEL: Record<ChallengeCadence, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" };

/** "day", "week", "month" */
export const PERIOD_NOUN: Record<ChallengeCadence, string> = { daily: "day", weekly: "week", monthly: "month" };
