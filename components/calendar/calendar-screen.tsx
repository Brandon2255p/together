"use client";

import { AnimatePresence, motion } from "motion/react";
import { ChevronLeftIcon, ChevronRightIcon, CoffeeIcon } from "lucide-react";
import type { MonthDay } from "@/lib/calendar/month";
import type { DayKey, Member, MemberTone } from "@/lib/models";
import { ChoreRow, type ChoreRowData } from "@/components/lists/chore-row";
import { AvatarStack, TONE_BG } from "@/components/ui/avatar";
import { IconButton } from "@/components/ui/icon-button";
import { InlineError, ScreenHeader, SectionHeader } from "@/components/ui/layout";
import { ListItem } from "@/components/ui/motion";
import { cn } from "@/lib/utils";

export type AgendaRow =
  | { kind: "event"; id: string; title: string; when: string; where: string | null; people: Member[]; tone: MemberTone | "ink" }
  | { kind: "chore"; id: string; row: ChoreRowData };

export interface CalendarScreenProps {
  monthLabel: string;
  yearLabel: string;
  weeks: MonthDay[][];
  today: DayKey;
  selected: DayKey;
  onSelect: (day: DayKey) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  legend: Member[];
  agendaTitle: string;
  agenda: AgendaRow[];
  onChoreDoneChange: (id: string, done: boolean) => void;
  loading: boolean;
  error: string | null;
}

const DOT: Record<MemberTone | "chore", string> = { ...TONE_BG, chore: "bg-ink-subtle" };
const BAR: Record<MemberTone | "ink", string> = { ...TONE_BG, ink: "bg-ink" };
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

export function CalendarScreen(props: CalendarScreenProps) {
  const { monthLabel, yearLabel, weeks, today, selected, onSelect, onPrevMonth, onNextMonth, legend, agendaTitle, agenda, onChoreDoneChange, loading, error } = props;
  return (
    <div className="flex flex-col gap-4">
      <ScreenHeader
        eyebrow={yearLabel}
        title={monthLabel}
        actions={
          <>
            <IconButton label="Previous month" onClick={onPrevMonth}>
              <ChevronLeftIcon />
            </IconButton>
            <IconButton label="Next month" onClick={onNextMonth}>
              <ChevronRightIcon />
            </IconButton>
          </>
        }
      />

      <div className={cn("rounded-card bg-surface px-2 py-3 transition-opacity", loading && "opacity-60")}>
        <div className="grid grid-cols-7 pb-1.5 text-center text-caption text-ink-subtle" aria-hidden>
          {WEEKDAYS.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div role="grid" aria-label={`${monthLabel} ${yearLabel}`} className="flex flex-col gap-0.5">
          {weeks.map((week) => (
            <div role="row" key={week[0]?.key} className="grid grid-cols-7">
              {week.map((day) => {
                const isSelected = day.key === selected;
                const isToday = day.key === today;
                return (
                  <button
                    role="gridcell"
                    key={day.key}
                    type="button"
                    aria-selected={isSelected}
                    aria-current={isToday ? "date" : undefined}
                    onClick={() => onSelect(day.key)}
                    className="flex flex-col items-center gap-[3px] py-1"
                  >
                    <span
                      className={cn(
                        "relative grid size-8 place-items-center rounded-full text-callout transition-colors",
                        !day.inMonth && "text-ink-subtle",
                        isToday && !isSelected && "text-accent-ink",
                        !isSelected && "hover:bg-surface-muted"
                      )}
                    >
                      {isSelected ? (
                        <motion.span
                          layoutId="calendar-selected"
                          className="absolute inset-0 rounded-full bg-ink"
                          transition={{ type: "spring", stiffness: 450, damping: 34 }}
                        />
                      ) : null}
                      <span className={cn("relative", isSelected && "text-on-accent")}>{day.day}</span>
                    </span>
                    <span className="flex h-[5px] gap-[3px]">
                      {day.dots.map((d) => (
                        <span key={d} className={cn("size-[5px] rounded-full", DOT[d])} />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3.5 text-caption text-ink-muted">
        {legend.map((m) => (
          <span key={m.id} className="flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", TONE_BG[m.tone])} />
            {m.name}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-ink-subtle" />
          Chores
        </span>
      </div>

      <InlineError>{error}</InlineError>

      <section className="flex flex-col gap-3">
        <SectionHeader title={agendaTitle} />
        <AnimatePresence mode="wait" initial={false}>
          <motion.ul
            key={selected}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col gap-2"
          >
            {agenda.length === 0 ? (
              <li className="flex items-center gap-2 rounded-row bg-surface px-4 py-4 text-callout text-ink-muted">
                <CoffeeIcon className="size-5" aria-hidden />
                Nothing planned.
              </li>
            ) : null}
            {agenda.map((entry) =>
              entry.kind === "event" ? (
                <ListItem key={entry.id} className="flex items-center gap-3.5 rounded-row bg-surface px-4 py-3.5">
                  <span className={cn("h-9 w-1 shrink-0 rounded-full", BAR[entry.tone])} aria-hidden />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-body-strong">{entry.title}</span>
                    <span className="text-caption text-ink-muted">
                      {entry.when}
                      {entry.where ? ` · ${entry.where}` : ""}
                    </span>
                  </span>
                  <AvatarStack members={entry.people} />
                </ListItem>
              ) : (
                <ListItem key={entry.id}>
                  <ChoreRow row={entry.row} onDoneChange={onChoreDoneChange} />
                </ListItem>
              )
            )}
          </motion.ul>
        </AnimatePresence>
      </section>
    </div>
  );
}
