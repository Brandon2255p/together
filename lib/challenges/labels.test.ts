import { describe, expect, it } from "vitest";
import { goalTargetLabel, historyLabel, periods, rangeLabel, timeLeftLabel } from "./labels";

describe("challenge labels", () => {
  it("names a period's days", () => {
    expect(rangeLabel("weekly", "2026-11-02")).toBe("Mon 2 – Sun 8 Nov");
    expect(rangeLabel("weekly", "2026-10-26")).toBe("Mon 26 Oct – Sun 1 Nov");
    expect(rangeLabel("monthly", "2026-11-01")).toBe("November");
    expect(rangeLabel("daily", "2026-11-08")).toBe("Sun 8 Nov");
  });

  it("says how long is left", () => {
    const base = { upcoming: false, start: "2026-11-02", done: false };
    expect(timeLeftLabel("weekly", { ...base, daysLeft: 4 })).toBe("4 days left");
    expect(timeLeftLabel("weekly", { ...base, daysLeft: 1 })).toBe("Ends tonight");
    expect(timeLeftLabel("daily", { ...base, daysLeft: 1, done: true })).toBe("Done for today");
    expect(timeLeftLabel("weekly", { ...base, daysLeft: 0, upcoming: true, start: "2026-11-09" })).toBe("Starts Mon 9 Nov");
  });

  it("describes a goal's target", () => {
    expect(goalTargetLabel("weekly", { target: 3 })).toBe("3× this week");
    expect(goalTargetLabel("weekly", { target: 1 })).toBe("Once this week");
    expect(goalTargetLabel("daily", { target: 1 })).toBe("Today");
    expect(goalTargetLabel("monthly", { target: 2 })).toBe("2× this month");
  });

  it("labels past periods and counts", () => {
    expect(historyLabel("weekly", "2026-11-02")).toBe("2 Nov");
    expect(historyLabel("monthly", "2026-11-01")).toBe("Nov");
    expect(periods("weekly", 1)).toBe("1 week");
    expect(periods("daily", 23)).toBe("23 days");
  });
});
