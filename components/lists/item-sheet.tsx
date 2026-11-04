"use client";

import { useState } from "react";
import { MinusIcon, PlusIcon, ShoppingBagIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { InlineError } from "@/components/ui/layout";
import { Sheet } from "@/components/ui/sheet";
import { TextField } from "@/components/ui/text-field";

export interface ItemDraft {
  name: string;
  quantity: number;
}

export interface ItemSheetProps {
  /** the item being edited, as a draft; null when closed */
  draft: ItemDraft | null;
  onDraftChange: (patch: Partial<ItemDraft>) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
  error: string | null;
}

const MAX_QUANTITY = 99;

/** Edit a shopping item: its name, how many, or take it off the list */
export function ItemSheet({ draft, onDraftChange, onClose, onSave, onDelete, error }: ItemSheetProps) {
  // UI-only: Remove asks once more before it happens
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const quantity = draft?.quantity ?? 1;
  return (
    <Sheet
      open={!!draft}
      onOpenChange={(open) => {
        setConfirmingDelete(false);
        if (!open) onClose();
      }}
      eyebrow="Edit item"
      title={draft?.name.trim() || "Shopping item"}
    >
      {draft ? (
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            onSave();
          }}
        >
          <TextField
            label="Item"
            icon={<ShoppingBagIcon aria-hidden />}
            maxLength={80}
            placeholder="e.g. Oat milk"
            value={draft.name}
            onChange={(e) => onDraftChange({ name: e.target.value })}
          />

          <div className="flex items-center justify-between rounded-field border border-line bg-surface py-2 pr-2 pl-[18px]">
            <span className="text-body text-ink-muted">How many</span>
            <div className="flex items-center gap-3">
              <IconButton
                label="One fewer"
                variant="surface"
                size="sm"
                disabled={quantity <= 1}
                onClick={() => onDraftChange({ quantity: quantity - 1 })}
              >
                <MinusIcon aria-hidden />
              </IconButton>
              <span className="w-6 text-center text-body-strong tabular-nums" aria-live="polite">
                {quantity}
              </span>
              <IconButton
                label="One more"
                variant="surface"
                size="sm"
                disabled={quantity >= MAX_QUANTITY}
                onClick={() => onDraftChange({ quantity: quantity + 1 })}
              >
                <PlusIcon aria-hidden />
              </IconButton>
            </div>
          </div>

          <InlineError>{error}</InlineError>
          <Button type="submit" block disabled={!draft.name.trim()}>
            Save
          </Button>
          {confirmingDelete ? (
            <div className="-mt-2 flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setConfirmingDelete(false)}>
                Keep it
              </Button>
              <Button variant="accent" className="flex-1" onClick={onDelete}>
                Remove
              </Button>
            </div>
          ) : (
            <Button variant="ghost" block className="-mt-2 text-accent-ink" onClick={() => setConfirmingDelete(true)}>
              <Trash2Icon className="size-4" aria-hidden />
              Remove from list
            </Button>
          )}
        </form>
      ) : null}
    </Sheet>
  );
}
