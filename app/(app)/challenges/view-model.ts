"use client";

import { useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import type { ChallengeDraft, GoalDraft, NewChallengeSheetProps } from "@/components/challenges/new-challenge-sheet";
import { addChallenge } from "@/lib/actions/challenges";
import { PERIOD_NOUN, startOptions, summarize } from "@/lib/challenges/streak";
import { rangeLabel } from "@/lib/challenges/labels";
import { addDays, dayDate } from "@/lib/format";
import type { Challenge, ChallengeCadence, DayKey, Together } from "@/lib/models";
import { challengeHref, toCard } from "../_lib/challenge-view";
import { useServerState } from "../_lib/server-state";

export interface ChallengesViewData {
  together: Together;
  today: DayKey;
  challenges: Challenge[];
}

let goalKey = 0;
const blankGoal = (): GoalDraft => ({ key: `goal-${++goalKey}`, title: "", target: 1 });
const emptyDraft = (meId: string): ChallengeDraft => ({ title: "", cadence: "weekly", start: "now", goals: [blankGoal()], memberIds: [meId] });

const RULES: Record<ChallengeCadence, string> = {
  daily: "Every day, midnight to midnight. Finish all the goals each day.",
  weekly: "Weeks run Monday to Sunday. Finish all the goals each week.",
  monthly: "Months run from the 1st to the last day. Finish all the goals each month.",
};

/** the two start choices for a cadence, as the pills word them */
function startLabels(cadence: ChallengeCadence, today: DayKey) {
  const { now, next } = startOptions(cadence, today);
  if (cadence === "daily") return { now: "Today", next: "Tomorrow" };
  if (cadence === "monthly") return { now: `This month · ${rangeLabel("monthly", now)}`, next: rangeLabel("monthly", next) };
  const sunday = addDays(next, -1);
  const day = (key: DayKey) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(dayDate(key));
  return { now: `This week · ends Sun ${dayDate(sunday).getUTCDate()}`, next: day(next) };
}

export function useChallengesViewModel(data: ChallengesViewData) {
  const { together, today } = data;
  const router = useRouter();
  const [challenges, setChallenges] = useServerState(data.challenges);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ChallengeDraft>(() => emptyDraft(together.meId));
  const [pending, setPending] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);

  const rows = challenges.map((c) => ({ c, s: summarize(c, today) }));
  const best = rows.filter((r) => r.s.streak > 0).sort((a, b) => b.s.streak - a.s.streak)[0];

  async function onSubmit() {
    const title = draft.title.trim();
    const goals = draft.goals.map((g) => ({ title: g.title.trim(), target: g.target })).filter((g) => g.title);
    if (!title) return setSheetError("Give the challenge a name.");
    if (!goals.length) return setSheetError("Add at least one goal.");
    if (!draft.memberIds.length) return setSheetError("Pick who's in it.");
    const { now, next } = startOptions(draft.cadence, today);
    setSheetError(null);
    setPending(true);
    const result = await addChallenge({ title, cadence: draft.cadence, startsOn: draft.start === "now" ? now : next, memberIds: draft.memberIds, goals });
    setPending(false);
    if (!result.data) return setSheetError(result.error ?? "Couldn't start that challenge. Try again.");
    const added = result.data;
    setChallenges((cs) => [added, ...cs]);
    setOpen(false);
    setDraft(emptyDraft(together.meId));
    router.push(challengeHref(added.id));
  }

  const sheet: NewChallengeSheetProps = {
    open,
    onOpenChange: setOpen,
    draft,
    onDraftChange: (patch) => setDraft((d) => ({ ...d, ...patch })),
    onGoalChange: (key, patch) => setDraft((d) => ({ ...d, goals: d.goals.map((g) => (g.key === key ? { ...g, ...patch } : g)) })),
    onAddGoal: () => setDraft((d) => ({ ...d, goals: [...d.goals, blankGoal()] })),
    onRemoveGoal: (key) => setDraft((d) => ({ ...d, goals: d.goals.filter((g) => g.key !== key) })),
    startLabels: startLabels(draft.cadence, today),
    startTitle: `First ${PERIOD_NOUN[draft.cadence]}`,
    rule: RULES[draft.cadence],
    perPeriod: draft.cadence === "daily" ? "a day" : `a ${PERIOD_NOUN[draft.cadence]}`,
    members: together.members,
    onSubmit: () => void onSubmit(),
    pending,
    error: sheetError,
  };

  return {
    back: "/home" as Route,
    hero: best ? { streak: best.s.streak, noun: `${PERIOD_NOUN[best.c.cadence]}s`, title: best.c.title, boosters: best.s.boosters } : null,
    challenges: rows.map(({ c, s }) => toCard(c, s, together)),
    onNew: () => {
      setSheetError(null);
      setOpen(true);
    },
    sheet,
    error: null,
  };
}
