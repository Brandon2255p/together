import { dayDate } from "@/lib/format";
import type { ChallengeCadence, ChallengeGoal, DayKey } from "@/lib/models";
import { PERIOD_NOUN, periodEnd } from "./streak";

// Words for challenge periods and goals, as the screens show them. Pure.

const fmt = (key: DayKey, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...options }).format(dayDate(key));

/** "Sun 8 Nov", "Mon 2 – Sun 8 Nov", "Mon 26 Oct – Sun 1 Nov", "November" */
export function rangeLabel(cadence: ChallengeCadence, start: DayKey): string {
  if (cadence === "daily") return fmt(start, { weekday: "short", day: "numeric", month: "short" });
  if (cadence === "monthly") return fmt(start, { month: "long" });
  const end = periodEnd(cadence, start);
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  const from = fmt(start, sameMonth ? { weekday: "short", day: "numeric" } : { weekday: "short", day: "numeric", month: "short" });
  return `${from} – ${fmt(end, { weekday: "short", day: "numeric", month: "short" })}`;
}

/** "Today", "This week", "This month" */
export function currentLabel(cadence: ChallengeCadence): string {
  return cadence === "daily" ? "Today" : `This ${PERIOD_NOUN[cadence]}`;
}

/** what's left of the current period: "Ends tonight", "1 day left", "4 days left", or when it starts */
export function timeLeftLabel(cadence: ChallengeCadence, current: { daysLeft: number; upcoming: boolean; start: DayKey; done: boolean }): string {
  if (current.upcoming) return `Starts ${fmt(current.start, { weekday: "short", day: "numeric", month: "short" })}`;
  if (current.done) return cadence === "daily" ? "Done for today" : `Done for this ${PERIOD_NOUN[cadence]}`;
  if (current.daysLeft <= 1) return "Ends tonight";
  return `${current.daysLeft} days left`;
}

/** under a goal: "Once this week", "3× this week", "Today", "8× today" */
export function goalTargetLabel(cadence: ChallengeCadence, goal: Pick<ChallengeGoal, "target">): string {
  if (cadence === "daily") return goal.target === 1 ? "Today" : `${goal.target}× today`;
  return goal.target === 1 ? `Once this ${PERIOD_NOUN[cadence]}` : `${goal.target}× this ${PERIOD_NOUN[cadence]}`;
}

/** a past period under its circle: "Sun", "2 Nov", "Oct" */
export function historyLabel(cadence: ChallengeCadence, start: DayKey): string {
  if (cadence === "daily") return fmt(start, { weekday: "short" });
  if (cadence === "monthly") return fmt(start, { month: "short" });
  return fmt(start, { day: "numeric", month: "short" });
}

/** "Weekly · Mon–Sun", "Monthly · from the 1st", "Daily" */
export function cadenceDetail(cadence: ChallengeCadence): string {
  if (cadence === "weekly") return "Weekly · Mon–Sun";
  if (cadence === "monthly") return "Monthly · from the 1st";
  return "Daily";
}

/** "1 week", "12 weeks", "1 day" */
export function periods(cadence: ChallengeCadence, n: number): string {
  return `${n} ${PERIOD_NOUN[cadence]}${n === 1 ? "" : "s"}`;
}
