import { addDays, dayDate, toKey } from "@/lib/format";
import type { CalendarEvent, Chore, DayKey, MemberTone } from "@/lib/models";

export interface MonthDay {
  key: DayKey;
  day: number;
  inMonth: boolean;
  /** one dot per kind of thing on the day: each member's events, then chores */
  dots: (MemberTone | "chore")[];
}

/** The month as weeks, Monday first, padded with the days around it */
export function monthGrid(
  year: number,
  month: number,
  events: CalendarEvent[],
  chores: Chore[],
  toneOf: (memberId: string) => MemberTone | undefined
): MonthDay[][] {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (first.getUTCDay() + 6) % 7; // Monday = 0
  const start = addDays(toKey(first), -offset);
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const weeks = Math.ceil((offset + lastDay) / 7);

  const grid: MonthDay[][] = [];
  for (let w = 0; w < weeks; w++) {
    const row: MonthDay[] = [];
    for (let i = 0; i < 7; i++) {
      const key = addDays(start, w * 7 + i);
      const date = dayDate(key);
      const dots = new Set<MonthDay["dots"][number]>();
      for (const e of events) {
        if (e.day !== key) continue;
        for (const a of e.attendees) {
          const tone = toneOf(a);
          if (tone) dots.add(tone);
        }
      }
      if (chores.some((c) => c.due === key && !c.done)) dots.add("chore");
      row.push({
        key,
        day: date.getUTCDate(),
        inMonth: date.getUTCMonth() === month,
        dots: (["accent", "partner", "success", "warning", "chore"] as const).filter((d) => dots.has(d)),
      });
    }
    grid.push(row);
  }
  return grid;
}

/** first and last DayKey the grid shows, to load events for */
export function gridRange(year: number, month: number): { from: DayKey; to: DayKey } {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const weeks = Math.ceil((offset + lastDay) / 7);
  const from = addDays(toKey(first), -offset);
  return { from, to: addDays(from, weeks * 7 - 1) };
}

export type AgendaEntry =
  | { kind: "event"; key: string; event: CalendarEvent }
  | { kind: "chore"; key: string; chore: Chore };

/** a day's events (by time, all-day first) then its chores */
export function agendaFor(day: DayKey, events: CalendarEvent[], chores: Chore[]): AgendaEntry[] {
  const evs = events
    .filter((e) => e.day === day)
    .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""))
    .map((event) => ({ kind: "event" as const, key: event.id, event }));
  const chs = chores.filter((c) => c.due === day).map((chore) => ({ kind: "chore" as const, key: chore.id, chore }));
  return [...evs, ...chs];
}
