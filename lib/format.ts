import type { DayKey } from "@/lib/models";

/** The Together's time zone. Shortcut until it's a setting. */
export const TIME_ZONE = "Africa/Johannesburg";

const pad = (n: number) => String(n).padStart(2, "0");

/** today's DayKey in the time zone */
export function todayKey(now: Date = new Date(), timeZone = TIME_ZONE): DayKey {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return parts; // en-CA formats as YYYY-MM-DD
}

/** a DayKey as a UTC-midnight Date (only for arithmetic and formatting in UTC) */
export function dayDate(key: DayKey): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
}

export function toKey(date: Date): DayKey {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function addDays(key: DayKey, days: number): DayKey {
  const d = dayDate(key);
  d.setUTCDate(d.getUTCDate() + days);
  return toKey(d);
}

export function diffDays(from: DayKey, to: DayKey): number {
  return Math.round((dayDate(to).getTime() - dayDate(from).getTime()) / 86_400_000);
}

const fmt = (key: DayKey, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...options }).format(dayDate(key));

/** "Today", "Tomorrow", "Thu", or "Fri, 7 Nov" further out */
export function dueLabel(due: DayKey, today: DayKey): string {
  const diff = diffDays(today, due);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff < 7) return fmt(due, { weekday: "short" });
  return fmt(due, { weekday: "short", day: "numeric", month: "short" });
}

/** "Tuesday, 3 November" */
export function longDate(key: DayKey): string {
  return fmt(key, { weekday: "long", day: "numeric", month: "long" });
}

/** "Tue 3" */
export function shortDay(key: DayKey): string {
  return fmt(key, { weekday: "short", day: "numeric" });
}

/** ["12", "Oct"] */
export function dayAndMonth(key: DayKey): [string, string] {
  return [fmt(key, { day: "2-digit" }), fmt(key, { month: "short" })];
}

export function monthName(year: number, month: number): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long" }).format(new Date(Date.UTC(year, month, 1)));
}

/** "Morning", "Afternoon" or "Evening" for the hour */
export function greeting(hour: number): string {
  if (hour < 12) return "Morning";
  if (hour < 18) return "Afternoon";
  return "Evening";
}

/** the hour now in the time zone */
export function hourNow(now: Date = new Date(), timeZone = TIME_ZONE): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(now));
}

/** R4,200 */
export function rands(amount: number): string {
  return `R${amount.toLocaleString("en-US")}`;
}
