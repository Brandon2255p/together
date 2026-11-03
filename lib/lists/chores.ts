import { diffDays } from "@/lib/format";
import type { Chore, DayKey, MemberId } from "@/lib/models";

export type ChoreFilter = "all" | "mine" | "partner" | "shared";

export function filterChores(chores: Chore[], filter: ChoreFilter, meId: MemberId): Chore[] {
  switch (filter) {
    case "mine":
      return chores.filter((c) => c.assignees.includes(meId));
    case "partner":
      return chores.filter((c) => c.assignees.some((a) => a !== meId));
    case "shared":
      return chores.filter((c) => c.assignees.length > 1);
    default:
      return chores;
  }
}

export interface ChoreSection {
  key: "overdue" | "week" | "later" | "anytime" | "done";
  title: string;
  chores: Chore[];
}

/** Groups chores for the list: overdue, this week, later, anytime (no due date), done. Empty groups are left out. */
export function choreSections(chores: Chore[], today: DayKey): ChoreSection[] {
  const byDue = (a: Chore, b: Chore) => (a.due ?? "").localeCompare(b.due ?? "");
  const open = chores.filter((c) => !c.done);
  const sections: ChoreSection[] = [
    { key: "overdue", title: "Overdue", chores: open.filter((c) => c.due && diffDays(today, c.due) < 0).sort(byDue) },
    { key: "week", title: "This week", chores: open.filter((c) => c.due && diffDays(today, c.due) >= 0 && diffDays(today, c.due) < 7).sort(byDue) },
    { key: "later", title: "Later", chores: open.filter((c) => c.due && diffDays(today, c.due) >= 7).sort(byDue) },
    { key: "anytime", title: "Anytime", chores: open.filter((c) => !c.due) },
    { key: "done", title: "Done", chores: chores.filter((c) => c.done) },
  ];
  return sections.filter((s) => s.chores.length > 0);
}

export const REPEAT_LABEL = { once: "Once", daily: "Daily", weekly: "Weekly", monthly: "Monthly" } as const;
