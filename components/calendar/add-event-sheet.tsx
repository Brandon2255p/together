"use client";

import { CheckIcon, MapPinIcon } from "lucide-react";
import type { DayKey, Member } from "@/lib/models";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PillButton } from "@/components/ui/chip";
import { InlineError } from "@/components/ui/layout";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export interface EventDraft {
  title: string;
  day: DayKey;
  /** HH:mm, or "" for all day */
  time: string;
  location: string;
  attendees: string[];
}

export interface AddEventSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: EventDraft;
  onDraftChange: (patch: Partial<EventDraft>) => void;
  /** the chosen day, written out ("Fri 6 Nov") */
  dayLabel: string;
  members: Member[];
  onSubmit: () => void;
  pending: boolean;
  error: string | null;
  /** "edit" changes an existing plan: Save instead of Add */
  mode?: "add" | "edit";
}

const INPUT =
  "h-14 w-full rounded-field border border-line bg-surface px-[18px] text-body outline-none placeholder:text-ink-subtle focus:border-ink focus:shadow-[0_0_0_1px_var(--color-ink)]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-caption text-ink-muted">{label}</p>
      {children}
    </div>
  );
}

export function AddEventSheet(props: AddEventSheetProps) {
  const { open, onOpenChange, draft, onDraftChange, dayLabel, members, onSubmit, pending, error, mode = "add" } = props;
  const editing = mode === "edit";
  const toggle = (id: string) =>
    onDraftChange({
      attendees: draft.attendees.includes(id) ? draft.attendees.filter((a) => a !== id) : [...draft.attendees, id],
    });

  return (
    <Sheet open={open} onOpenChange={onOpenChange} eyebrow={editing ? "Edit plan" : "New plan"} title={draft.title.trim() || "What's happening?"}>
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <label className="flex flex-col gap-2.5">
          <span className="text-caption text-ink-muted">What</span>
          <input
            autoFocus={!editing}
            value={draft.title}
            maxLength={120}
            onChange={(e) => onDraftChange({ title: e.target.value })}
            placeholder="e.g. Dinner with Sam"
            className={INPUT}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Day">
            <label className="relative flex h-14 items-center rounded-field border border-line bg-surface px-[18px] text-body">
              {dayLabel}
              <input
                type="date"
                aria-label="Day"
                required
                className="absolute inset-0 opacity-0"
                value={draft.day}
                onChange={(e) => e.target.value && onDraftChange({ day: e.target.value })}
              />
            </label>
          </Field>
          <Field label="Time · optional">
            <label className="flex h-14 items-center gap-2 rounded-field border border-line bg-surface px-[18px] focus-within:border-ink">
              <input
                type="time"
                aria-label="Time"
                value={draft.time}
                onChange={(e) => onDraftChange({ time: e.target.value })}
                className="min-w-0 flex-1 bg-transparent text-body outline-none"
              />
            </label>
          </Field>
        </div>
        {draft.time ? (
          <PillButton selected={false} onClick={() => onDraftChange({ time: "" })} className="self-start">
            Make it all day
          </PillButton>
        ) : null}

        <Field label="Where · optional">
          <label className="flex h-14 items-center gap-3 rounded-field border border-line bg-surface px-[18px] focus-within:border-ink">
            <MapPinIcon className="size-5 shrink-0 text-ink-muted" aria-hidden />
            <input
              value={draft.location}
              maxLength={120}
              onChange={(e) => onDraftChange({ location: e.target.value })}
              placeholder="e.g. Sea Point"
              className="min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-ink-subtle"
            />
          </label>
        </Field>

        <Field label="Who's going">
          <div className="flex flex-wrap items-center gap-2.5">
            {members.map((m) => {
              const on = draft.attendees.includes(m.id);
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
          </div>
        </Field>

        <InlineError>{error}</InlineError>
        <Button type="submit" block pending={pending}>
          {editing ? "Save" : "Add to calendar"}
        </Button>
      </form>
    </Sheet>
  );
}
