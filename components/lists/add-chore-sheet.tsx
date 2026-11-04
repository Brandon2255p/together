"use client";

import { useState } from "react";
import { CalendarIcon, CheckIcon, Trash2Icon, UsersIcon } from "lucide-react";
import type { ChoreRepeat, DayKey, Member } from "@/lib/models";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PillButton } from "@/components/ui/chip";
import { InlineError } from "@/components/ui/layout";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export interface ChoreDraft {
  title: string;
  due: DayKey | null;
  repeat: ChoreRepeat;
  assignees: string[];
}

export interface AddChoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: ChoreDraft;
  onDraftChange: (patch: Partial<ChoreDraft>) => void;
  /** quick picks: No date, Today, Tomorrow, the weekend… */
  dueOptions: { value: DayKey | null; label: string }[];
  /** label for a date picked from the calendar input, when it isn't a quick pick */
  customDueLabel: string | null;
  members: Member[];
  onSubmit: () => void;
  pending: boolean;
  error: string | null;
  /** "edit" changes an existing chore: Save instead of Add, and a Delete */
  mode?: "add" | "edit";
  onDelete?: () => void;
}

const REPEATS: { value: ChoreRepeat; label: string }[] = [
  { value: "once", label: "Once" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-caption text-ink-muted">{label}</p>
      {children}
    </div>
  );
}

export function AddChoreSheet(props: AddChoreSheetProps) {
  const { open, onOpenChange, draft, onDraftChange, dueOptions, customDueLabel, members, onSubmit, pending, error, mode = "add", onDelete } = props;
  // UI-only: Delete asks once more before it happens
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const editing = mode === "edit";
  const isQuick = dueOptions.some((o) => o.value === draft.due);
  const toggle = (id: string) =>
    onDraftChange({
      assignees: draft.assignees.includes(id) ? draft.assignees.filter((a) => a !== id) : [...draft.assignees, id],
    });

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setConfirmingDelete(false);
        onOpenChange(next);
      }}
      eyebrow={editing ? "Edit chore" : "New chore"}
      title={draft.title.trim() || "What needs doing?"}
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <label className="flex flex-col gap-2.5">
          <span className="text-caption text-ink-muted">Chore</span>
          <input
            autoFocus={!editing}
            maxLength={120}
            value={draft.title}
            onChange={(e) => onDraftChange({ title: e.target.value })}
            placeholder="e.g. Water the plants"
            className="h-14 rounded-field border border-line bg-surface px-[18px] text-body outline-none placeholder:text-ink-subtle focus:border-ink focus:shadow-[0_0_0_1px_var(--color-ink)]"
          />
        </label>

        <Field label="Due date · optional">
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none]">
            {dueOptions.map((o) => (
              <PillButton key={o.label} selected={draft.due === o.value} onClick={() => onDraftChange({ due: o.value })}>
                {o.label}
              </PillButton>
            ))}
            <label
              className={cn(
                "relative inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-chip px-3.5 py-2 text-caption",
                !isQuick && draft.due ? "bg-ink text-on-accent" : "border border-line bg-surface text-ink-muted"
              )}
            >
              <CalendarIcon className="size-3.5" aria-hidden />
              {!isQuick && customDueLabel ? customDueLabel : "Pick"}
              <input
                type="date"
                aria-label="Pick a due date"
                className="absolute inset-0 opacity-0"
                value={draft.due ?? ""}
                onChange={(e) => onDraftChange({ due: e.target.value || null })}
              />
            </label>
          </div>
        </Field>

        <Field label="Repeat">
          <Segmented label="Repeat" size="sm" options={REPEATS} value={draft.repeat} onValueChange={(repeat) => onDraftChange({ repeat })} />
        </Field>

        <Field label="Assign to">
          <div className="flex flex-wrap items-center gap-2.5">
            {members.map((m) => {
              const on = draft.assignees.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(m.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-full py-1.5 pr-3.5 pl-1.5 text-callout transition-[box-shadow,background-color] duration-200",
                    on ? "bg-surface shadow-[0_0_0_1.5px_var(--color-ink)]" : "bg-surface-muted text-ink-muted"
                  )}
                >
                  <Avatar member={m} />
                  {m.name}
                  {on ? <CheckIcon className="size-4 text-success" aria-hidden /> : null}
                </button>
              );
            })}
            {draft.assignees.length > 1 ? (
              <span className="flex items-center gap-1.5 text-caption text-ink-muted">
                <UsersIcon className="size-4" aria-hidden />
                Shared
              </span>
            ) : null}
          </div>
        </Field>

        <InlineError>{error}</InlineError>
        <Button type="submit" block pending={pending}>
          {editing ? "Save" : "Add chore"}
        </Button>
        {editing && onDelete ? (
          confirmingDelete ? (
            <div className="-mt-2 flex flex-col gap-2">
              <p className="text-center text-caption text-ink-muted">Delete it for everyone? This can&apos;t be undone.</p>
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={() => setConfirmingDelete(false)}>
                  Keep it
                </Button>
                <Button variant="accent" className="flex-1" onClick={onDelete}>
                  Delete
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="ghost" block className="-mt-2 text-accent-ink" onClick={() => setConfirmingDelete(true)}>
              <Trash2Icon className="size-4" aria-hidden />
              Delete chore
            </Button>
          )
        ) : null}
      </form>
    </Sheet>
  );
}
