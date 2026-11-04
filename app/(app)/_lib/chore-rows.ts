import type { ChoreRowData } from "@/components/lists/chore-row";
import { diffDays, dueLabel } from "@/lib/format";
import { REPEAT_LABEL } from "@/lib/lists/chores";
import type { Chore, DayKey, Member } from "@/lib/models";
import type { Optimistic } from "./optimistic";

/** Shapes a chore for <ChoreRow>: due chip (coral today, amber soon, red-ish overdue), repeat chip, assignees */
export function toChoreRow(chore: Optimistic<Chore>, members: Member[], today: DayKey): ChoreRowData {
  const chips: ChoreRowData["chips"] = [];
  if (chore.due && !chore.done) {
    const diff = diffDays(today, chore.due);
    chips.push({
      label: diff < 0 ? `Overdue · ${dueLabel(chore.due, today)}` : dueLabel(chore.due, today),
      tone: diff <= 0 ? "accent" : diff < 3 ? "warning" : "neutral",
    });
  }
  if (chore.repeat !== "once") chips.push({ label: REPEAT_LABEL[chore.repeat], tone: "neutral", repeat: true });
  return {
    id: chore.id,
    key: chore.clientKey ?? chore.id,
    title: chore.title,
    done: chore.done,
    people: chore.assignees.map((id) => members.find((m) => m.id === id)).filter((m): m is Member => !!m),
    chips,
  };
}
