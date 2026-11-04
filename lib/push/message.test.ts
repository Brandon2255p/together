import { describe, expect, it } from "vitest";
import { choreReminderMessage } from "./message";

describe("choreReminderMessage", () => {
  it("names a single chore", () => {
    expect(choreReminderMessage(["Water the plants"])).toEqual({ title: "Due today", body: "Water the plants", url: "/lists?tab=chores" });
  });

  it("counts several and lists the first three", () => {
    expect(choreReminderMessage(["A", "B"]).title).toBe("2 chores due today");
    expect(choreReminderMessage(["A", "B"]).body).toBe("A, B");
    expect(choreReminderMessage(["A", "B", "C", "D", "E"]).body).toBe("A, B, C and 2 more");
  });
});
