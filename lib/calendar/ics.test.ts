import { describe, expect, it } from "vitest";
import type { CalendarFeed, FeedEvent } from "@/lib/models";
import { buildIcs, escapeText, foldLine, zonedTime } from "./ics";

const event = (patch: Partial<FeedEvent> = {}): FeedEvent => ({
  id: "e-1",
  title: "Dinner",
  day: "2026-11-20",
  time: "19:30",
  location: null,
  placeName: null,
  attendees: [],
  createdAt: "2026-11-01T08:00:00.000Z",
  ...patch,
});
const feed = (events: FeedEvent[], timeZone = "Africa/Johannesburg"): CalendarFeed => ({ togetherName: "B & A", timeZone, events });
const now = new Date("2026-11-19T10:00:00Z");
const unfold = (ics: string) => ics.replace(/\r\n /g, "");

describe("zonedTime", () => {
  it("reads a wall-clock time in the zone", () => {
    expect(zonedTime("2026-11-20", "19:30", "Africa/Johannesburg").toISOString()).toBe("2026-11-20T17:30:00.000Z");
  });

  it("follows daylight saving", () => {
    expect(zonedTime("2026-07-01", "09:00", "Europe/London").toISOString()).toBe("2026-07-01T08:00:00.000Z");
    expect(zonedTime("2026-12-01", "09:00", "Europe/London").toISOString()).toBe("2026-12-01T09:00:00.000Z");
    // the morning the clocks go forward in New York
    expect(zonedTime("2026-03-08", "08:00", "America/New_York").toISOString()).toBe("2026-03-08T12:00:00.000Z");
  });
});

describe("escapeText", () => {
  it("escapes what iCalendar reserves", () => {
    expect(escapeText("Braai; bring chairs, ice\\ and\nwood")).toBe("Braai\\; bring chairs\\, ice\\\\ and\\nwood");
  });
});

describe("foldLine", () => {
  it("leaves short lines alone", () => {
    expect(foldLine("SUMMARY:Dinner")).toBe("SUMMARY:Dinner");
  });

  it("folds at 75 octets without splitting a character", () => {
    const line = `SUMMARY:${"é".repeat(60)}`;
    const folded = foldLine(line);
    const enc = new TextEncoder();
    for (const part of folded.split("\r\n")) expect(enc.encode(part).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, "")).toBe(line);
  });
});

describe("buildIcs", () => {
  it("wraps plans in a named calendar with CRLF line endings", () => {
    const ics = buildIcs(feed([event()]), { now });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("X-WR-CALNAME:Together · B & A");
    expect(ics).toContain("X-WR-TIMEZONE:Africa/Johannesburg");
    expect(ics.split("\r\n").every((l) => !l.includes("\n"))).toBe(true);
  });

  it("gives a timed plan an hour, in UTC", () => {
    const ics = buildIcs(feed([event()]), { now });
    expect(ics).toContain("UID:e-1@together");
    expect(ics).toContain("DTSTAMP:20261119T100000Z");
    expect(ics).toContain("DTSTART:20261120T173000Z");
    expect(ics).toContain("DTEND:20261120T183000Z");
    expect(ics).toContain("CREATED:20261101T080000Z");
  });

  it("makes an all-day plan last its day, even at the end of a month", () => {
    const ics = buildIcs(feed([event({ day: "2026-11-30", time: null })]), { now });
    expect(ics).toContain("DTSTART;VALUE=DATE:20261130");
    expect(ics).toContain("DTEND;VALUE=DATE:20261201");
  });

  it("adds where, who's going, the place and a link back", () => {
    const ics = unfold(
      buildIcs(feed([event({ location: "Sea Point", placeName: "Nobu", attendees: ["Brandon", "Adele"] })]), { now, appUrl: "https://together.app" })
    );
    expect(ics).toContain("LOCATION:Sea Point");
    expect(ics).toContain("DESCRIPTION:Going: Brandon & Adele\\nA plan to go to Nobu");
    expect(ics).toContain("URL:https://together.app/calendar?day=2026-11-20");
  });

  it("uses the place as the location when there's none", () => {
    const ics = buildIcs(feed([event({ placeName: "Nobu" })]), { now });
    expect(ics).toContain("LOCATION:Nobu");
    expect(ics).not.toContain("DESCRIPTION");
    expect(ics).not.toContain("URL:");
  });

  it("is a valid empty calendar with no plans", () => {
    const ics = buildIcs(feed([]), { now });
    expect(ics).not.toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VCALENDAR");
  });
});
