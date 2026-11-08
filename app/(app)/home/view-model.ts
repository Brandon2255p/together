"use client";

import type { Route } from "next";
import { dueLabel, greeting, hourNow, longDate } from "@/lib/format";
import { summarize } from "@/lib/challenges/streak";
import type { CalendarEvent, Challenge, Chore, DayKey, Member, Together, TogetherSummary } from "@/lib/models";
import { toChoreRow } from "../_lib/chore-rows";
import { useChoreSheet } from "../_lib/use-chore-sheet";
import { useChores } from "../_lib/use-chores";

export interface HomeViewData {
  together: Together;
  today: DayKey;
  chores: Chore[];
  toBuy: number;
  wantToGo: number;
  /** today onwards, for "Up next" */
  events: CalendarEvent[];
  /** all your Togethers, for the switcher pill */
  togethers: TogetherSummary[];
  /** for the flame pill: the longest streak going */
  challenges: Challenge[];
}

const LINKS = {
  chores: "/lists?tab=chores" as Route,
  shopping: "/lists" as Route,
  places: "/places?tab=want" as Route,
  calendar: "/calendar" as Route,
  together: "/together" as Route,
  togethers: "/togethers" as Route,
  profile: "/profile" as Route,
  challenges: "/challenges" as Route,
};

export function useHomeViewModel(data: HomeViewData) {
  const { together, today } = data;
  const choreStore = useChores(data.chores);
  const { chores, error, toggle } = choreStore;
  const choreSheet = useChoreSheet(together, today, choreStore);
  const me = together.members.find((m) => m.id === together.meId);
  const people = (ids: string[]) => ids.map((id) => together.members.find((m) => m.id === id)).filter((m): m is Member => !!m);

  const next = [...data.events].sort((a, b) => (a.day + (a.time ?? "")).localeCompare(b.day + (b.time ?? "")))[0];
  const upNext = next
    ? {
        title: next.title,
        when: next.day === today ? (next.time ?? "All day") : `${dueLabel(next.day, today)}${next.time ? ` · ${next.time}` : ""}`,
        where: next.location,
        people: people(next.attendees),
      }
    : null;

  // due today or overdue; stays on screen once ticked until the next visit
  const dueToday = chores
    .filter((c) => c.due !== null && c.due <= today && (c.assignees.includes(together.meId) || c.assignees.length > 1))
    .map((c) => toChoreRow(c, together.members, today));

  const streaks = data.challenges.map((c) => summarize(c, today));

  return {
    greeting: `${greeting(hourNow())}, ${me?.name ?? "you"}`,
    dateLabel: longDate(today),
    members: together.members,
    switcher: {
      name: together.name,
      tone: me?.tone ?? "accent",
      hasNews: data.togethers.some((t) => !t.current && t.hasNews),
    },
    streak: {
      count: Math.max(0, ...streaks.map((s) => s.streak)),
      atRisk: streaks.some((s) => s.atRisk !== null),
    },
    upNext,
    dueToday,
    onChoreDoneChange: (id: string, done: boolean) => void toggle(id, done),
    onChoreOpen: choreSheet.openEdit,
    choreSheet: choreSheet.sheet,
    toBuy: data.toBuy,
    wantToGo: data.wantToGo,
    links: LINKS,
    error,
  };
}
