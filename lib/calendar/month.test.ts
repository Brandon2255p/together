import { describe, expect, it } from "vitest";
import type { CalendarEvent, Chore } from "@/lib/models";
import { agendaFor, gridRange, monthGrid } from "./month";

const tone = (id: string) => (id === "b" ? ("accent" as const) : id === "a" ? ("partner" as const) : undefined);

describe("monthGrid", () => {
  it("starts on Monday and pads November 2026 (starts on a Sunday) to 6 weeks", () => {
    const grid = monthGrid(2026, 10, [], [], tone);
    expect(grid).toHaveLength(6);
    expect(grid[0]?.[0]).toMatchObject({ key: "2026-10-26", inMonth: false });
    expect(grid[0]?.[6]).toMatchObject({ key: "2026-11-01", day: 1, inMonth: true });
    expect(grid[5]?.[0]).toMatchObject({ key: "2026-11-30", inMonth: true });
  });

  it("adds a dot per member with an event and one for open chores", () => {
    const events: CalendarEvent[] = [
      { id: "1", title: "Dinner", day: "2026-11-03", time: "19:30", location: null, attendees: ["b", "a"], place: null },
    ];
    const chores: Chore[] = [
      { id: "c", title: "Bins", due: "2026-11-03", repeat: "once", assignees: ["b"], done: false },
      { id: "d", title: "Done", due: "2026-11-04", repeat: "once", assignees: ["b"], done: true },
    ];
    const days = monthGrid(2026, 10, events, chores, tone).flat();
    expect(days.find((d) => d.key === "2026-11-03")?.dots).toEqual(["accent", "partner", "chore"]);
    expect(days.find((d) => d.key === "2026-11-04")?.dots).toEqual([]);
  });
});

describe("gridRange", () => {
  it("covers the padded weeks", () => {
    expect(gridRange(2026, 10)).toEqual({ from: "2026-10-26", to: "2026-12-06" });
  });
});

describe("agendaFor", () => {
  it("lists events by time, then chores", () => {
    const events: CalendarEvent[] = [
      { id: "late", title: "Late", day: "2026-11-03", time: "20:00", location: null, attendees: [], place: null },
      { id: "early", title: "Early", day: "2026-11-03", time: "08:00", location: null, attendees: [], place: null },
    ];
    const chores: Chore[] = [{ id: "c", title: "Bins", due: "2026-11-03", repeat: "once", assignees: [], done: false }];
    expect(agendaFor("2026-11-03", events, chores).map((e) => e.key)).toEqual(["early", "late", "c"]);
  });
});
