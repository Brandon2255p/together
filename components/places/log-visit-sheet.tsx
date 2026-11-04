"use client";

import { CalendarIcon, HeartIcon, SparklesIcon, StarIcon } from "lucide-react";
import type { DayKey } from "@/lib/models";
import { Button } from "@/components/ui/button";
import { chipVariants } from "@/components/ui/chip";
import { InlineError } from "@/components/ui/layout";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { FieldLabel, OptionChip } from "./fields";

export interface VisitDraft {
  day: DayKey;
  title: string;
  note: string;
  /** whole stars, 1–5; null for no rating */
  rating: number | null;
}

export interface LogVisitSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "Nobu · Sea Point, Cape Town" */
  subtitle: string;
  draft: VisitDraft;
  onDraftChange: (patch: Partial<VisitDraft>) => void;
  today: DayKey;
  yesterday: DayKey;
  /** "Tue, 3 Nov" when a day other than today or yesterday is picked */
  pickedLabel: string | null;
  /** "Adele rates it on their own. The place moves to Been." */
  footnote: string;
  onSubmit: () => void;
  pending: boolean;
  error: string | null;
}

const field =
  "flex h-14 items-center gap-3 rounded-field border border-line bg-surface px-[18px] transition-[border-color,box-shadow] duration-200 focus-within:border-ink focus-within:shadow-[0_0_0_1px_var(--color-ink)] [&>svg]:size-5 [&>svg]:shrink-0 [&>svg]:text-ink-muted";

export function LogVisitSheet(props: LogVisitSheetProps) {
  const { open, onOpenChange, subtitle, draft, onDraftChange, today, yesterday, pickedLabel, footnote, onSubmit, pending, error } = props;
  const custom = draft.day !== today && draft.day !== yesterday;
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Log a visit" className="gap-4">
      <p className="-mt-3 text-caption text-ink-muted">{subtitle}</p>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <div className="flex flex-col gap-2">
          <FieldLabel>When</FieldLabel>
          <div className="flex flex-wrap gap-2">
            <OptionChip selected={draft.day === today} onClick={() => onDraftChange({ day: today })}>
              Today
            </OptionChip>
            <OptionChip selected={draft.day === yesterday} onClick={() => onDraftChange({ day: yesterday })}>
              Yesterday
            </OptionChip>
            <label className={cn(chipVariants({ tone: custom ? "accent" : "neutral" }), "relative cursor-pointer px-3 py-1.5")}>
              <CalendarIcon aria-hidden />
              {custom && pickedLabel ? pickedLabel : "Pick a date…"}
              <input
                type="date"
                aria-label="Pick the day of the visit"
                className="absolute inset-0 opacity-0"
                max={today}
                value={draft.day}
                onChange={(e) => e.target.value && onDraftChange({ day: e.target.value })}
              />
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <FieldLabel>What</FieldLabel>
          <label className={field}>
            <SparklesIcon aria-hidden />
            <span className="sr-only">What did you do?</span>
            <input
              value={draft.title}
              onChange={(e) => onDraftChange({ title: e.target.value })}
              placeholder="e.g. Dinner with Mom"
              maxLength={120}
              className="min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-ink-subtle"
            />
          </label>
          <label className={field}>
            <HeartIcon aria-hidden />
            <span className="sr-only">A note</span>
            <input
              value={draft.note}
              onChange={(e) => onDraftChange({ note: e.target.value })}
              placeholder="A note (optional)"
              maxLength={500}
              className="min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-ink-subtle"
            />
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <FieldLabel>Your rating</FieldLabel>
          <div className="flex items-center justify-between py-2">
            <div role="radiogroup" aria-label="Your rating" className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => {
                const on = draft.rating !== null && n <= draft.rating;
                return (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={draft.rating === n}
                    aria-label={n === 1 ? "1 star" : `${n} stars`}
                    // tapping the current rating clears it
                    onClick={() => onDraftChange({ rating: draft.rating === n ? null : n })}
                    className="grid size-10 place-items-center transition-transform active:scale-90"
                  >
                    <StarIcon className={cn("size-8", on ? "fill-warning text-warning" : "text-ink-subtle")} strokeWidth={1.5} aria-hidden />
                  </button>
                );
              })}
            </div>
            <span className="text-callout text-ink-muted">{draft.rating ? `${draft.rating} of 5` : "Not rated"}</span>
          </div>
        </div>

        <p className="text-caption text-ink-muted">{footnote}</p>
        <InlineError>{error}</InlineError>
        <Button type="submit" block pending={pending}>
          Save visit
        </Button>
      </form>
    </Sheet>
  );
}
