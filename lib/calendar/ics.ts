import type { CalendarFeed, DayKey, FeedEvent } from "@/lib/models";

// Builds the .ics (iCalendar, RFC 5545) text that Google Calendar, Apple Calendar and Outlook subscribe to. Times go out
// in UTC, worked out from the Together's time zone, so no VTIMEZONE block is needed. Plans have no end time, so a
// timed plan lasts an hour and an all-day plan lasts its day.

const pad = (n: number) => String(n).padStart(2, "0");

/** 2026-11-19 → 20261119 */
const icsDate = (day: DayKey) => day.replaceAll("-", "");

/** a moment as 20261119T173000Z */
function icsUtc(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

/** the next day, as a DayKey */
function nextDay(day: DayKey): DayKey {
  const [y, m, d] = day.split("-").map(Number);
  const next = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + 1));
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

/** how far the zone is ahead of UTC at a moment, in minutes */
function offsetMinutes(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** a wall-clock day and HH:mm in a zone, as the moment it is */
export function zonedTime(day: DayKey, time: string, timeZone: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  const wall = Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, h ?? 0, min ?? 0);
  // guess with the offset at the wall time read as UTC, then correct once for a daylight-saving change in between
  const first = wall - offsetMinutes(new Date(wall), timeZone) * 60_000;
  return new Date(wall - offsetMinutes(new Date(first), timeZone) * 60_000);
}

/** escapes TEXT values: backslash, semicolon, comma and line breaks */
export function escapeText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** folds a content line at 75 octets, continuing with CRLF and a space, without splitting a UTF-8 character */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const out: string[] = [];
  let current = "";
  let bytes = 0;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    // continuation lines start with a space, which counts towards their 75
    const limit = out.length === 0 ? 75 : 74;
    if (bytes + size > limit) {
      out.push(current);
      current = "";
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  out.push(current);
  return out.join("\r\n ");
}

function eventLines(event: FeedEvent, timeZone: string, stamp: string, appUrl: string | null): string[] {
  const lines = ["BEGIN:VEVENT", `UID:${event.id}@together`, `DTSTAMP:${stamp}`];
  if (event.time === null) {
    lines.push(`DTSTART;VALUE=DATE:${icsDate(event.day)}`, `DTEND;VALUE=DATE:${icsDate(nextDay(event.day))}`);
  } else {
    const start = zonedTime(event.day, event.time, timeZone);
    lines.push(`DTSTART:${icsUtc(start)}`, `DTEND:${icsUtc(new Date(start.getTime() + 3_600_000))}`);
  }
  lines.push(`SUMMARY:${escapeText(event.title)}`);
  const where = event.location ?? event.placeName;
  if (where) lines.push(`LOCATION:${escapeText(where)}`);
  const about = [
    event.attendees.length ? `Going: ${event.attendees.join(" & ")}` : null,
    event.placeName && event.placeName !== where ? `A plan to go to ${event.placeName}` : null,
  ].filter((x): x is string => x !== null);
  if (about.length) lines.push(`DESCRIPTION:${escapeText(about.join("\n"))}`);
  if (appUrl) lines.push(`URL:${appUrl}/calendar?day=${event.day}`);
  const created = new Date(event.createdAt);
  if (!Number.isNaN(created.getTime())) lines.push(`CREATED:${icsUtc(created)}`);
  lines.push("TRANSP:OPAQUE", "END:VEVENT");
  return lines;
}

/**
 * The whole calendar as .ics text, CRLF line endings included.
 * `appUrl` (the app's origin) adds a link back to each plan's day.
 */
export function buildIcs(feed: CalendarFeed, { now = new Date(), appUrl = null }: { now?: Date; appUrl?: string | null } = {}): string {
  const stamp = icsUtc(now);
  const name = `Together · ${feed.togetherName}`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Together//Calendar feed//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `NAME:${escapeText(name)}`,
    `X-WR-CALNAME:${escapeText(name)}`,
    `X-WR-TIMEZONE:${feed.timeZone}`,
    // how often subscribers should check for changes; Apple honours it, Google refreshes on its own schedule
    "REFRESH-INTERVAL;VALUE=DURATION:PT15M",
    "X-PUBLISHED-TTL:PT15M",
    ...feed.events.flatMap((e) => eventLines(e, feed.timeZone, stamp, appUrl)),
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
