"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Celebration } from "@/components/challenges/celebrations";
import type { ChallengeScreenProps } from "@/components/challenges/challenge-screen";
import { deleteChallenge, setChallengeGoalCount, settleMissedPeriod } from "@/lib/actions/challenges";
import { cadenceDetail, currentLabel, goalTargetLabel, historyLabel, rangeLabel, timeLeftLabel } from "@/lib/challenges/labels";
import { BOOSTER_EVERY, MAX_BOOSTERS, PERIOD_NOUN, goalDone, summarize } from "@/lib/challenges/streak";
import type { Challenge, DayKey, Together } from "@/lib/models";
import {
  CADENCE_TONE,
  finishCelebrations,
  membersOf,
  missedBody,
  missedDeadline,
  missedEyebrow,
  missedHeading,
  savedCelebration,
} from "../../_lib/challenge-view";
import { useServerState } from "../../_lib/server-state";

export interface ChallengeViewData {
  together: Together;
  today: DayKey;
  challenge: Challenge;
}

/** how long the tick's burst plays before the celebration takes over */
const CELEBRATE_AFTER_MS = 750;
const PAST: Record<Challenge["cadence"], string> = { daily: "Past days", weekly: "Past weeks", monthly: "Past months" };

export function useChallengeViewModel(data: ChallengeViewData): ChallengeScreenProps {
  const { together, today } = data;
  const router = useRouter();
  const [challenge, setChallenge] = useServerState(data.challenge);
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<Celebration[]>([]);
  // a streak at risk offers the booster as soon as the challenge opens
  const [missedOpen, setMissedOpen] = useState(() => summarize(data.challenge, today).atRisk !== null);
  const [missedPending, setMissedPending] = useState(false);
  const [missedError, setMissedError] = useState<string | null>(null);
  const celebrateTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // the count last asked for per goal: an older answer arriving late mustn't undo a newer tap
  const latest = useRef<Record<string, number>>({});

  const summary = summarize(challenge, today);
  const { cadence } = challenge;
  const noun = PERIOD_NOUN[cadence];

  async function onCountChange(goalId: string, count: number) {
    const goal = challenge.goals.find((g) => g.id === goalId);
    if (!goal || summary.current.upcoming) return;
    const next = Math.max(0, Math.min(goal.target, count));
    if (next === goal.count) return;
    const before = challenge;
    const updated: Challenge = { ...challenge, goals: challenge.goals.map((g) => (g.id === goalId ? { ...g, count: next } : g)) };
    const after = summarize(updated, today);
    setError(null);
    setChallenge(updated);
    // the last goal of the period: let the tick play, then celebrate
    clearTimeout(celebrateTimer.current);
    if (!summary.current.done && after.current.done) {
      const celebrations = finishCelebrations(updated, summary, after);
      celebrateTimer.current = setTimeout(() => setQueue(celebrations), CELEBRATE_AFTER_MS);
    }
    latest.current[goalId] = next;
    const result = await setChallengeGoalCount(goalId, next);
    if (latest.current[goalId] !== next) return;
    if (!result.data) {
      clearTimeout(celebrateTimer.current);
      setQueue([]);
      setChallenge(before);
      setError(result.error ?? "Couldn't save that. Try again.");
      return;
    }
    const saved = result.data;
    // keep other goals' taps that are still saving
    setChallenge((c) => ({ ...saved, goals: saved.goals.map((g) => (g.id === goalId ? g : (c.goals.find((x) => x.id === g.id) ?? g))) }));
  }

  async function settle(useBooster: boolean) {
    setMissedPending(true);
    setMissedError(null);
    const result = await settleMissedPeriod(challenge.id, useBooster);
    setMissedPending(false);
    if (!result.data) return setMissedError(result.error ?? "Couldn't save that. Try again.");
    const saved = result.data;
    setChallenge(saved);
    setMissedOpen(false);
    if (useBooster) setQueue([savedCelebration(saved, summarize(saved, today))]);
  }

  async function onDelete() {
    const result = await deleteChallenge(challenge.id);
    if (!result.success) return setError(result.error ?? "Couldn't delete that challenge.");
    router.push("/challenges");
  }

  const history = summary.history.slice(0, 12).reverse();
  const ended = summary.history.length + (summary.current.done ? 1 : 0);

  return {
    back: "/challenges",
    title: challenge.title,
    cadence: cadenceDetail(cadence),
    tone: CADENCE_TONE[cadence],
    members: membersOf(challenge, together),
    streak: summary.streak,
    streakNoun: `${noun} streak`,
    bestLine:
      summary.streak > 0 && summary.streak >= summary.best
        ? "Your best yet"
        : summary.best > 0
          ? `Best: ${summary.best}`
          : ended
            ? `Finish every goal to start a new one`
            : `Finish every goal to start your streak`,
    boosters: { held: summary.boosters, max: MAX_BOOSTERS, toNext: summary.toNextBooster, every: BOOSTER_EVERY },
    period: {
      label: currentLabel(cadence),
      range: rangeLabel(cadence, summary.current.start),
      left: timeLeftLabel(cadence, summary.current),
      done: summary.current.done,
      upcoming: summary.current.upcoming,
      goalsDone: summary.current.goalsDone,
      goalsTotal: summary.current.goalsTotal,
    },
    goals: challenge.goals.map((g) => ({
      id: g.id,
      title: g.title,
      detail: goalTargetLabel(cadence, g),
      target: g.target,
      count: g.count,
      done: goalDone(g),
      locked: summary.current.upcoming,
    })),
    onCountChange: (goalId, count) => void onCountChange(goalId, count),
    historyTitle: PAST[cadence],
    history: history.map((p) => ({ key: p.start, label: historyLabel(cadence, p.start), state: p.state })),
    atRisk: summary.atRisk ? missedHeading(cadence) : null,
    onOpenMissed: () => {
      setMissedError(null);
      setMissedOpen(true);
    },
    missed: {
      open: missedOpen && summary.atRisk !== null,
      onOpenChange: setMissedOpen,
      eyebrow: summary.atRisk ? missedEyebrow(cadence, summary.atRisk.start) : "",
      heading: missedHeading(cadence),
      body: summary.atRisk ? missedBody(cadence, summary.atRisk.streak) : "",
      boosters: summary.boosters,
      deadline: missedDeadline(cadence, summary.current.end),
      onUseBooster: () => void settle(true),
      onReset: () => void settle(false),
      pending: missedPending,
      error: missedError,
    },
    celebration: queue[0] ?? null,
    onCelebrationNext: () => setQueue((q) => q.slice(1)),
    onDelete: () => void onDelete(),
    error,
  };
}
