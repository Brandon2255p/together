"use client";

import { AnimatePresence } from "motion/react";
import { PlusIcon, SparklesIcon } from "lucide-react";
import { ChoreRow, type ChoreRowData } from "@/components/lists/chore-row";
import { PillButton } from "@/components/ui/chip";
import { EmptyState, InlineError, SectionHeader } from "@/components/ui/layout";
import { ListItem } from "@/components/ui/motion";

export interface ChoresPanelProps<F extends string> {
  filters: { value: F; label: string }[];
  filter: F;
  onFilterChange: (filter: F) => void;
  sections: { key: string; title: string; rows: ChoreRowData[] }[];
  onDoneChange: (id: string, done: boolean) => void;
  onOpen: (id: string) => void;
  onAddPress: () => void;
  error: string | null;
}

export function ChoresPanel<F extends string>(props: ChoresPanelProps<F>) {
  const { filters, filter, onFilterChange, sections, onDoneChange, onOpen, onAddPress, error } = props;
  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={onAddPress}
        className="flex h-14 items-center gap-3 rounded-field border border-line bg-surface px-[18px] text-left text-body text-ink-subtle transition-colors hover:border-ink-subtle"
      >
        <PlusIcon className="size-5 text-ink-muted" aria-hidden />
        Add a chore…
      </button>

      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none]" role="group" aria-label="Show chores for">
        {filters.map((f) => (
          <PillButton key={f.value} selected={f.value === filter} onClick={() => onFilterChange(f.value)}>
            {f.label}
          </PillButton>
        ))}
      </div>

      <InlineError>{error}</InlineError>

      {sections.length === 0 ? (
        <EmptyState icon={<SparklesIcon aria-hidden />} title="All clear" body="No chores here. Add one, or enjoy the quiet." />
      ) : null}

      {sections.map((section) => (
        <section key={section.key} className="flex flex-col gap-3">
          <SectionHeader title={section.title} />
          <ul className="flex flex-col gap-2">
            <AnimatePresence initial={false} mode="popLayout">
              {section.rows.map((row) => (
                <ListItem key={row.key ?? row.id}>
                  <ChoreRow row={row} onDoneChange={onDoneChange} onOpen={onOpen} />
                </ListItem>
              ))}
            </AnimatePresence>
          </ul>
        </section>
      ))}
    </div>
  );
}
