"use client";

import { ExternalLinkIcon, LinkIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/layout";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";

const INPUT =
  "h-14 w-full rounded-field border border-line bg-surface px-[18px] text-body outline-none placeholder:text-ink-subtle focus:border-ink focus:shadow-[0_0_0_1px_var(--color-ink)]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2.5">
      <span className="text-caption text-ink-muted">{label}</span>
      {children}
    </label>
  );
}

function Rands({ value, onChange, placeholder, autoFocus }: { value: string; onChange: (v: string) => void; placeholder: string; autoFocus?: boolean }) {
  return (
    <span className="flex h-14 items-center gap-1 rounded-field border border-line bg-surface px-[18px] focus-within:border-ink focus-within:shadow-[0_0_0_1px_var(--color-ink)]">
      <span className="text-body text-ink-muted">R</span>
      <input
        inputMode="numeric"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d\s,.]/g, ""))}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-ink-subtle"
      />
    </span>
  );
}

interface FormSheet {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
  error: string | null;
}

// ---- Add a wish ----

export interface WishDraft {
  name: string;
  price: string;
  url: string;
}

export function AddWishSheet({ open, onOpenChange, onSubmit, error, draft, onDraftChange }: FormSheet & { draft: WishDraft; onDraftChange: (patch: Partial<WishDraft>) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} eyebrow="New wish" title={draft.name.trim() || "What would you love?"}>
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <Field label="Wish">
          <input autoFocus value={draft.name} maxLength={120} onChange={(e) => onDraftChange({ name: e.target.value })} placeholder="e.g. Pour-over set" className={INPUT} />
        </Field>
        <Field label="Price · optional">
          <Rands value={draft.price} onChange={(price) => onDraftChange({ price })} placeholder="650" />
        </Field>
        <Field label="Link · optional">
          <span className="flex h-14 items-center gap-3 rounded-field border border-line bg-surface px-[18px] focus-within:border-ink focus-within:shadow-[0_0_0_1px_var(--color-ink)]">
            <LinkIcon className="size-5 shrink-0 text-ink-muted" aria-hidden />
            <input
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              value={draft.url}
              onChange={(e) => onDraftChange({ url: e.target.value })}
              placeholder="Where to buy it"
              className="min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-ink-subtle"
            />
          </span>
        </Field>
        <InlineError>{error}</InlineError>
        <Button type="submit" block>
          Add to my wishlist
        </Button>
      </form>
    </Sheet>
  );
}

// ---- One of your wishes ----

export interface WishSheetData {
  id: string;
  name: string;
  price: string | null;
  url: string | null;
}

export function WishSheet({ wish, onClose, onDelete, pending, error }: { wish: WishSheetData | null; onClose: () => void; onDelete: (id: string) => void; pending: boolean; error: string | null }) {
  return (
    <Sheet open={wish !== null} onOpenChange={(open) => !open && onClose()} eyebrow={wish?.price ?? "Your wish"} title={wish?.name ?? ""}>
      {wish ? (
        <div className="flex flex-col gap-3">
          {wish.url ? (
            <a href={wish.url} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 rounded-row bg-surface-muted px-4 py-3.5 text-callout">
              <ExternalLinkIcon className="size-4 shrink-0 text-ink-muted" aria-hidden />
              <span className="truncate">{new URL(wish.url).hostname.replace(/^www\./, "")}</span>
            </a>
          ) : null}
          <InlineError>{error}</InlineError>
          <Button block variant="outline" pending={pending} onClick={() => onDelete(wish.id)}>
            <Trash2Icon className="size-4" aria-hidden />
            Remove from my wishlist
          </Button>
        </div>
      ) : null}
    </Sheet>
  );
}

// ---- A new goal ----

export interface GoalDraft {
  title: string;
  target: string;
  shared: boolean;
}

export function AddGoalSheet({
  open,
  onOpenChange,
  onSubmit,
  error,
  draft,
  onDraftChange,
  canShare,
}: FormSheet & { draft: GoalDraft; onDraftChange: (patch: Partial<GoalDraft>) => void; canShare: boolean }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} eyebrow="New goal" title={draft.title.trim() || "What are you saving for?"}>
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <Field label="Saving for">
          <input autoFocus value={draft.title} maxLength={120} onChange={(e) => onDraftChange({ title: e.target.value })} placeholder="e.g. Weekend away" className={INPUT} />
        </Field>
        <Field label="You need">
          <Rands value={draft.target} onChange={(target) => onDraftChange({ target })} placeholder="8000" />
        </Field>
        {canShare ? (
          <div className="flex flex-col gap-2.5">
            <span className="text-caption text-ink-muted">Whose goal</span>
            <Segmented
              label="Whose goal"
              size="sm"
              value={draft.shared ? "shared" : "mine"}
              onValueChange={(v) => onDraftChange({ shared: v === "shared" })}
              options={[
                { value: "mine", label: "Mine" },
                { value: "shared", label: "Together" },
              ]}
            />
          </div>
        ) : null}
        <InlineError>{error}</InlineError>
        <Button type="submit" block>
          Start saving
        </Button>
      </form>
    </Sheet>
  );
}

// ---- Put money towards a goal ----

export interface SavingsSheetData {
  id: string;
  title: string;
  /** "R4,200 of R8,000" */
  progress: string;
}

export function SavingsSheet({
  goal,
  amount,
  onAmountChange,
  onClose,
  onSubmit,
  error,
}: {
  goal: SavingsSheetData | null;
  amount: string;
  onAmountChange: (amount: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  error: string | null;
}) {
  return (
    <Sheet open={goal !== null} onOpenChange={(open) => !open && onClose()} eyebrow={goal?.progress ?? ""} title={goal ? `Add to ${goal.title}` : ""}>
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <Field label="Amount">
          <Rands autoFocus value={amount} onChange={onAmountChange} placeholder="500" />
        </Field>
        <InlineError>{error}</InlineError>
        <Button type="submit" block>
          Add savings
        </Button>
      </form>
    </Sheet>
  );
}
