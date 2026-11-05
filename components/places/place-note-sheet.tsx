"use client";

import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/layout";
import { Sheet } from "@/components/ui/sheet";

export const NOTE_MAX = 500;

export interface PlaceNoteSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** the place's name, as the sheet's title */
  placeName: string;
  draft: string;
  onDraftChange: (text: string) => void;
  /** whether the place already has a note, so it can be removed */
  hasNote: boolean;
  onSubmit: () => void;
  onRemove: () => void;
  pending: boolean;
  error: string | null;
}

/** A place's note: why you want to go, or anything else worth remembering. Shared with everyone in the Together. */
export function PlaceNoteSheet(props: PlaceNoteSheetProps) {
  const { open, onOpenChange, placeName, draft, onDraftChange, hasNote, onSubmit, onRemove, pending, error } = props;
  const left = NOTE_MAX - draft.length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange} eyebrow={hasNote ? "Edit note" : "Add a note"} title={placeName}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <label className="flex flex-col gap-2.5">
          <span className="text-caption text-ink-muted">Why you want to go, or anything else</span>
          <textarea
            autoFocus
            value={draft}
            rows={5}
            maxLength={NOTE_MAX}
            onChange={(e) => onDraftChange(e.target.value)}
            placeholder="e.g. Sam says the gnocchi is the best in town. Book the window table."
            className="w-full resize-none rounded-field border border-line bg-surface px-[18px] py-4 text-body outline-none placeholder:text-ink-subtle focus:border-ink focus:shadow-[0_0_0_1px_var(--color-ink)]"
          />
          <span className={left < 50 ? "self-end text-caption text-warning-ink" : "self-end text-caption text-ink-subtle"}>
            {left} left
          </span>
        </label>
        <p className="text-caption text-ink-muted">Everyone in your Together sees it.</p>
        <InlineError>{error}</InlineError>
        <Button type="submit" block pending={pending}>
          Save note
        </Button>
        {hasNote ? (
          <Button type="button" block variant="ghost" disabled={pending} onClick={onRemove}>
            Remove note
          </Button>
        ) : null}
      </form>
    </Sheet>
  );
}
