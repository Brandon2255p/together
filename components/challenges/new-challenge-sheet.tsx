"use client";

import { AnimatePresence, motion } from "motion/react";
import { CalendarIcon, CheckIcon, MinusIcon, PlusIcon, XIcon } from "lucide-react";
import type { ChallengeCadence, Member } from "@/lib/models";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PillButton } from "@/components/ui/chip";
import { InlineError } from "@/components/ui/layout";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export interface GoalDraft {
  key: string;
  title: string;
  target: number;
}

export interface ChallengeDraft {
  title: string;
  cadence: ChallengeCadence;
  /** start in the period today is in, or the next one */
  start: "now" | "next";
  goals: GoalDraft[];
  memberIds: string[];
}

export interface NewChallengeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: ChallengeDraft;
  onDraftChange: (patch: Partial<Omit<ChallengeDraft, "goals">>) => void;
  onGoalChange: (key: string, patch: Partial<Omit<GoalDraft, "key">>) => void;
  onAddGoal: () => void;
  onRemoveGoal: (key: string) => void;
  /** labels for the two start choices, for the chosen cadence: "Today" / "Tomorrow", "This week · ends Sun 8" / "Mon 9 Nov" */
  startLabels: { now: string; next: string };
  /** "First day", "First week", "First month" */
  startTitle: string;
  /** "Weeks run Monday to Sunday." */
  rule: string;
  /** "this week", for the stepper */
  perPeriod: string;
  members: Member[];
  onSubmit: () => void;
  pending: boolean;
  error: string | null;
}

const CADENCES: { value: ChallengeCadence; label: string }[] = [
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

export function NewChallengeSheet(props: NewChallengeSheetProps) {
  const { open, onOpenChange, draft, onDraftChange, onGoalChange, onAddGoal, onRemoveGoal, startLabels, startTitle, rule, perPeriod, members, onSubmit, pending, error } = props;
  const toggle = (id: string) =>
    onDraftChange({ memberIds: draft.memberIds.includes(id) ? draft.memberIds.filter((m) => m !== id) : [...draft.memberIds, id] });

  return (
    <Sheet open={open} onOpenChange={onOpenChange} eyebrow="New challenge" title={draft.title.trim() || "What's the challenge?"}>
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <label className="flex flex-col gap-2.5">
          <span className="text-caption text-ink-muted">Name</span>
          <input
            autoFocus
            maxLength={120}
            value={draft.title}
            onChange={(e) => onDraftChange({ title: e.target.value })}
            placeholder="e.g. Gym together"
            className="h-14 rounded-field border border-line bg-surface px-[18px] text-body outline-none placeholder:text-ink-subtle focus:border-ink focus:shadow-[0_0_0_1px_var(--color-ink)]"
          />
        </label>

        <Field label="Repeats">
          <Segmented label="Repeats" options={CADENCES} value={draft.cadence} onValueChange={(cadence) => onDraftChange({ cadence })} />
          <p className="flex items-start gap-2 text-caption text-ink-muted">
            <CalendarIcon className="mt-px size-4 shrink-0" aria-hidden />
            {rule}
          </p>
        </Field>

        <Field label={startTitle}>
          <div className="flex flex-wrap gap-2">
            <PillButton selected={draft.start === "now"} onClick={() => onDraftChange({ start: "now" })} className="px-4 py-2.5 text-callout">
              {startLabels.now}
            </PillButton>
            <PillButton selected={draft.start === "next"} onClick={() => onDraftChange({ start: "next" })} className="px-4 py-2.5 text-callout">
              {startLabels.next}
            </PillButton>
          </div>
        </Field>

        <Field label="Goals · finish them all to score">
          <ul className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {draft.goals.map((g, i) => (
                <motion.li
                  key={g.key}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 rounded-field bg-surface-muted py-1.5 pr-1.5 pl-4"
                >
                  <input
                    aria-label={`Goal ${i + 1}`}
                    maxLength={120}
                    value={g.title}
                    onChange={(e) => onGoalChange(g.key, { title: e.target.value })}
                    placeholder={i === 0 ? "e.g. Go to the gym" : "Another goal"}
                    className="h-10 min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-ink-subtle"
                  />
                  <span className="flex shrink-0 items-center rounded-full bg-surface">
                    <button
                      type="button"
                      aria-label="Fewer times"
                      disabled={g.target <= 1}
                      onClick={() => onGoalChange(g.key, { target: g.target - 1 })}
                      className="grid size-9 place-items-center text-ink-muted disabled:opacity-30"
                    >
                      <MinusIcon className="size-4" aria-hidden />
                    </button>
                    <span className="min-w-12 text-center text-caption font-semibold" aria-live="polite">
                      {g.target === 1 ? "Once" : `${g.target}×`}
                    </span>
                    <button
                      type="button"
                      aria-label={`More times ${perPeriod}`}
                      disabled={g.target >= 99}
                      onClick={() => onGoalChange(g.key, { target: g.target + 1 })}
                      className="grid size-9 place-items-center disabled:opacity-30"
                    >
                      <PlusIcon className="size-4" aria-hidden />
                    </button>
                  </span>
                  {draft.goals.length > 1 ? (
                    <button type="button" aria-label="Remove goal" onClick={() => onRemoveGoal(g.key)} className="grid size-9 shrink-0 place-items-center text-ink-subtle hover:text-ink">
                      <XIcon className="size-4" aria-hidden />
                    </button>
                  ) : null}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          <button
            type="button"
            onClick={onAddGoal}
            className="flex h-11 items-center gap-2 rounded-field border-[1.5px] border-dashed border-line px-4 text-callout text-ink-muted hover:text-ink"
          >
            <PlusIcon className="size-5" aria-hidden />
            Add a goal
          </button>
        </Field>

        {members.length > 1 ? (
          <Field label="Who's in">
            <div className="flex flex-wrap items-center gap-2.5">
              {members.map((m) => {
                const on = draft.memberIds.includes(m.id);
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
            {draft.memberIds.length > 1 ? <p className="text-caption text-ink-muted">Any of you can tick a goal.</p> : null}
          </Field>
        ) : null}

        <InlineError>{error}</InlineError>
        <Button type="submit" block pending={pending}>
          Start challenge
        </Button>
      </form>
    </Sheet>
  );
}
