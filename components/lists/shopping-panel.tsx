"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { PlusIcon, ShoppingBagIcon } from "lucide-react";
import type { ItemSuggestion, Member } from "@/lib/models";
import { splitMatch } from "@/lib/lists/suggest";
import { Chip } from "@/components/ui/chip";
import { EmptyState, InlineError, SectionHeader } from "@/components/ui/layout";
import { ListItem } from "@/components/ui/motion";
import { TaskRow } from "@/components/ui/task-row";
import { TextField } from "@/components/ui/text-field";
import { cn } from "@/lib/utils";

export interface ShoppingRowData {
  id: string;
  label: string;
  done: boolean;
  addedBy: Member | null;
}

export interface ShoppingPanelProps {
  query: string;
  onQueryChange: (query: string) => void;
  suggestions: ItemSuggestion[];
  /** adds a suggestion, or whatever was typed */
  onAdd: (name: string) => void;
  toBuy: ShoppingRowData[];
  inBasket: ShoppingRowData[];
  onDoneChange: (id: string, done: boolean) => void;
  onClearBasket: () => void;
  error: string | null;
}

const REASON = { usual: { label: "Usual", tone: "accent" }, popular: { label: "Popular", tone: "neutral" } } as const;

function Rows({ rows, onDoneChange }: { rows: ShoppingRowData[]; onDoneChange: ShoppingPanelProps["onDoneChange"] }) {
  return (
    <ul className="flex flex-col gap-2">
      <AnimatePresence initial={false} mode="popLayout">
        {rows.map((row) => (
          <ListItem key={row.id}>
            <TaskRow
              title={row.label}
              done={row.done}
              onDoneChange={(done) => onDoneChange(row.id, done)}
              people={row.addedBy ? [row.addedBy] : []}
            />
          </ListItem>
        ))}
      </AnimatePresence>
    </ul>
  );
}

export function ShoppingPanel(props: ShoppingPanelProps) {
  const { query, onQueryChange, suggestions, onAdd, toBuy, inBasket, onDoneChange, onClearBasket, error } = props;
  // UI-only state: whether the field has focus and which suggestion the arrow keys are on
  const [focused, setFocused] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const open = focused && suggestions.length > 0;

  const choose = (name: string) => {
    onAdd(name);
    setHighlight(0);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="relative z-20">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const picked = open ? suggestions[highlight]?.name : undefined;
            choose(picked ?? query);
          }}
        >
          <TextField
            label="Add an item"
            placeholder="Add an item…"
            icon={<PlusIcon aria-hidden />}
            value={query}
            role="combobox"
            aria-expanded={open}
            aria-controls="shopping-suggestions"
            aria-autocomplete="list"
            autoComplete="off"
            enterKeyHint="done"
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 120)}
            onChange={(e) => {
              onQueryChange(e.target.value);
              setHighlight(0);
            }}
            onKeyDown={(e) => {
              if (!open) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlight((h) => (h + 1) % suggestions.length);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
              } else if (e.key === "Escape") {
                onQueryChange("");
              }
            }}
          />
        </form>
        <AnimatePresence>
          {open ? (
            <motion.ul
              id="shopping-suggestions"
              role="listbox"
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 500, damping: 34 }}
              className="absolute inset-x-0 top-[calc(100%+8px)] flex origin-top flex-col gap-0.5 rounded-[22px] bg-surface p-2 shadow-float"
            >
              {suggestions.map((s, i) => {
                const [before, match, after] = splitMatch(s.name, query);
                return (
                  <li key={s.name} role="option" aria-selected={i === highlight}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => choose(s.name)}
                      onMouseEnter={() => setHighlight(i)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-[14px] px-3 py-3 text-left text-body transition-colors",
                        i === highlight && "bg-surface-muted"
                      )}
                    >
                      <PlusIcon className="size-[18px] text-ink-muted" aria-hidden />
                      <span className="flex-1">
                        {before}
                        <strong className="font-bold">{match}</strong>
                        {after}
                      </span>
                      {s.reason ? <Chip tone={REASON[s.reason].tone}>{REASON[s.reason].label}</Chip> : null}
                    </button>
                  </li>
                );
              })}
            </motion.ul>
          ) : null}
        </AnimatePresence>
      </div>

      <InlineError>{error}</InlineError>

      {toBuy.length === 0 && inBasket.length === 0 ? (
        <EmptyState icon={<ShoppingBagIcon aria-hidden />} title="The list is empty" body="Add something above — it shows up for both of you instantly." />
      ) : null}

      {toBuy.length ? (
        <section className="flex flex-col gap-3">
          <SectionHeader title={`To buy · ${toBuy.length}`} />
          <Rows rows={toBuy} onDoneChange={onDoneChange} />
        </section>
      ) : null}

      {inBasket.length ? (
        <section className="flex flex-col gap-3">
          <SectionHeader
            title={`In the basket · ${inBasket.length}`}
            action={
              <button type="button" onClick={onClearBasket}>
                Clear
              </button>
            }
          />
          <Rows rows={inBasket} onDoneChange={onDoneChange} />
        </section>
      ) : null}
    </div>
  );
}
