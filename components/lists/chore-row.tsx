"use client";

import { RepeatIcon } from "lucide-react";
import type { Member } from "@/lib/models";
import { Chip, type ChipTone } from "@/components/ui/chip";
import { TaskRow } from "@/components/ui/task-row";

/** A chore shaped for display by the view-model */
export interface ChoreRowData {
  id: string;
  /** stays the same when an optimistic row is swapped for the saved one, so it doesn't animate out and back in */
  key?: string;
  title: string;
  done: boolean;
  people: Member[];
  chips: { label: string; tone: ChipTone; repeat?: boolean }[];
}

export function ChoreRow({
  row,
  onDoneChange,
  onOpen,
}: {
  row: ChoreRowData;
  onDoneChange: (id: string, done: boolean) => void;
  /** opens the chore to edit it */
  onOpen?: (id: string) => void;
}) {
  return (
    <TaskRow
      onOpen={onOpen ? () => onOpen(row.id) : undefined}
      title={row.title}
      done={row.done}
      onDoneChange={(done) => onDoneChange(row.id, done)}
      people={row.people}
      meta={
        row.chips.length
          ? row.chips.map((c) => (
              <Chip key={c.label} tone={c.tone}>
                {c.repeat ? <RepeatIcon aria-hidden /> : null}
                {c.label}
              </Chip>
            ))
          : undefined
      }
    />
  );
}
