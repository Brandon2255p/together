import { describe, expect, it } from "vitest";
import type { Challenge, ChallengeOutcome } from "@/lib/models";
import { nextPeriod, periodEnd, periodStartOf, previousPeriod, startOptions, summarize } from "./streak";

// 2026-11-08 is a Sunday; 2026-11-02 the Monday before it
const goals = (counts: [number, number][]) => counts.map(([count, target], i) => ({ id: `g${i}`, title: `Goal ${i}`, count, target }));

function weekly(startsOn: string, outcomes: [string, ChallengeOutcome][], counts: [number, number][] = [[0, 1]], periodStart = "2026-11-02") {
  const c: Pick<Challenge, "cadence" | "startsOn" | "periods" | "goals" | "periodStart"> = {
    cadence: "weekly",
    startsOn,
    periods: outcomes.map(([start, outcome]) => ({ start, outcome })),
    goals: goals(counts),
    periodStart,
  };
  return c;
}

/** n weeks done in a row, ending the week before 2026-11-02 */
const doneWeeks = (n: number, before = "2026-11-02"): [string, ChallengeOutcome][] => {
  const out: [string, ChallengeOutcome][] = [];
  let p = before;
  for (let i = 0; i < n; i++) {
    p = previousPeriod("weekly", p);
    out.push([p, "done"]);
  }
  return out;
};

describe("periods", () => {
  it("weeks start on Monday", () => {
    expect(periodStartOf("weekly", "2026-11-08")).toBe("2026-11-02");
    expect(periodStartOf("weekly", "2026-11-02")).toBe("2026-11-02");
    expect(periodStartOf("weekly", "2026-11-04")).toBe("2026-11-02");
    expect(periodEnd("weekly", "2026-11-02")).toBe("2026-11-08");
  });

  it("months start on the 1st and end on their last day", () => {
    expect(periodStartOf("monthly", "2026-11-18")).toBe("2026-11-01");
    expect(nextPeriod("monthly", "2026-12-01")).toBe("2027-01-01");
    expect(previousPeriod("monthly", "2026-03-01")).toBe("2026-02-01");
    expect(periodEnd("monthly", "2028-02-01")).toBe("2028-02-29");
  });

  it("days are themselves", () => {
    expect(periodStartOf("daily", "2026-11-08")).toBe("2026-11-08");
    expect(periodEnd("daily", "2026-11-08")).toBe("2026-11-08");
  });

  it("offers this period or the next to start in", () => {
    expect(startOptions("weekly", "2026-11-07")).toEqual({ now: "2026-11-02", next: "2026-11-09" });
    expect(startOptions("monthly", "2026-11-07")).toEqual({ now: "2026-11-01", next: "2026-12-01" });
  });
});

describe("summarize", () => {
  it("counts done weeks in a row, and this week once its goals are done", () => {
    const open = summarize(weekly("2026-09-07", doneWeeks(8), [[2, 3], [1, 1]]), "2026-11-04");
    expect(open.streak).toBe(8);
    expect(open.current).toMatchObject({ start: "2026-11-02", end: "2026-11-08", daysLeft: 5, done: false, goalsDone: 1, goalsTotal: 2 });

    const finished = summarize(weekly("2026-09-07", doneWeeks(8), [[3, 3], [1, 1]]), "2026-11-04");
    expect(finished.streak).toBe(9);
    expect(finished.current.done).toBe(true);
  });

  it("a missed week with no booster resets the streak", () => {
    const outcomes = doneWeeks(3, "2026-10-26"); // done up to 12 Oct–18 Oct, then 19 Oct missed and 26 Oct missed
    const s = summarize(weekly("2026-08-31", outcomes), "2026-11-04");
    expect(s.streak).toBe(0);
    expect(s.atRisk).toBeNull();
    expect(s.history[0]).toEqual({ start: "2026-10-26", state: "missed" });
  });

  it("earns a booster every 5 in a row, up to 3", () => {
    expect(summarize(weekly("2026-01-05", doneWeeks(4)), "2026-11-04")).toMatchObject({ boosters: 0, toNextBooster: 1 });
    expect(summarize(weekly("2026-01-05", doneWeeks(5)), "2026-11-04")).toMatchObject({ boosters: 1, toNextBooster: 5 });
    expect(summarize(weekly("2026-01-05", doneWeeks(23)), "2026-11-04")).toMatchObject({ boosters: 3, streak: 23, best: 23 });
  });

  it("finishing this week can earn the booster straight away", () => {
    expect(summarize(weekly("2026-01-05", doneWeeks(4), [[1, 1]]), "2026-11-04")).toMatchObject({ streak: 5, boosters: 1 });
  });

  it("puts the streak at risk when last week was missed and there's a booster", () => {
    const outcomes = doneWeeks(6, "2026-10-26"); // 6 done, then 26 Oct missed
    const s = summarize(weekly("2026-01-05", outcomes), "2026-11-04");
    expect(s.atRisk).toEqual({ start: "2026-10-26", streak: 6 });
    expect(s.streak).toBe(6);
    expect(s.boosters).toBe(1);
  });

  it("a booster covers the missed week and keeps the streak without adding to it", () => {
    const outcomes: [string, ChallengeOutcome][] = [...doneWeeks(6, "2026-10-26"), ["2026-10-26", "boosted"]];
    const s = summarize(weekly("2026-01-05", outcomes), "2026-11-04");
    expect(s).toMatchObject({ streak: 6, boosters: 0, atRisk: null });
    expect(s.history[0]).toEqual({ start: "2026-10-26", state: "boosted" });
  });

  it("letting it reset ends the streak", () => {
    const outcomes: [string, ChallengeOutcome][] = [...doneWeeks(6, "2026-10-26"), ["2026-10-26", "reset"]];
    expect(summarize(weekly("2026-01-05", outcomes), "2026-11-04")).toMatchObject({ streak: 0, atRisk: null, boosters: 1 });
  });

  it("a miss that wasn't saved in time is gone for good", () => {
    // 19 Oct missed, nobody decided during 26 Oct's week, and 26 Oct was done
    const outcomes: [string, ChallengeOutcome][] = [...doneWeeks(6, "2026-10-19"), ["2026-10-26", "done"]];
    expect(summarize(weekly("2026-01-05", outcomes), "2026-11-04")).toMatchObject({ streak: 1, atRisk: null });
  });

  it("a challenge that hasn't started can't be done yet", () => {
    const s = summarize(weekly("2026-11-09", [], [[1, 1]], "2026-11-09"), "2026-11-07");
    expect(s.current).toMatchObject({ start: "2026-11-09", upcoming: true, done: false, daysLeft: 0 });
    expect(s.history).toEqual([]);
  });

  it("ignores counts left over from an older period", () => {
    const s = summarize(weekly("2026-10-05", [], [[1, 1]], "2026-10-26"), "2026-11-04");
    expect(s.current.done).toBe(false);
  });

  it("works for daily and monthly challenges", () => {
    const daily = summarize(
      { cadence: "daily", startsOn: "2026-11-01", periodStart: "2026-11-08", goals: goals([[1, 1]]), periods: ["01", "02", "03", "04", "05", "06", "07"].map((d) => ({ start: `2026-11-${d}`, outcome: "done" as const })) },
      "2026-11-08",
    );
    expect(daily).toMatchObject({ streak: 8, boosters: 1, current: { daysLeft: 1 } });
    const monthly = summarize({ cadence: "monthly", startsOn: "2026-09-01", periodStart: "2026-11-01", goals: goals([[0, 2]]), periods: [{ start: "2026-09-01", outcome: "done" }, { start: "2026-10-01", outcome: "done" }] }, "2026-11-08");
    expect(monthly).toMatchObject({ streak: 2, current: { start: "2026-11-01", end: "2026-11-30", daysLeft: 23 } });
  });
});
