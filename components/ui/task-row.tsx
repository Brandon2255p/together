"use client";

import { motion } from "motion/react";
import type { Member } from "@/lib/models";
import { AvatarStack } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

/**
 * A row with a round tick: chores, shopping items and calendar chores.
 * `meta` holds chips (due date, repeat). `people` are the assignees, or who added a shopping item.
 * With `onOpen`, tapping the row (anywhere but the tick) opens it to edit.
 */
export function TaskRow({
  title,
  done,
  onDoneChange,
  meta,
  people = [],
  onOpen,
  className,
}: {
  title: string;
  done: boolean;
  onDoneChange?: (done: boolean) => void;
  meta?: React.ReactNode;
  people?: Pick<Member, "id" | "name" | "initial" | "tone">[];
  onOpen?: () => void;
  className?: string;
}) {
  const body = (
    <>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="relative w-fit max-w-full text-body-strong">
          <span className={cn("block truncate transition-colors duration-300", done ? "text-ink-subtle" : "text-ink")}>
            {title}
          </span>
          {/* animated strike-through */}
          <motion.span
            aria-hidden
            className="absolute top-1/2 left-0 h-[1.5px] w-full origin-left bg-ink-subtle"
            initial={false}
            animate={{ scaleX: done ? 1 : 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          />
        </span>
        {meta ? <div className="flex flex-wrap gap-1.5">{meta}</div> : null}
      </div>
      {people.length ? <AvatarStack members={people} /> : null}
    </>
  );
  return (
    <div
      className={cn(
        "flex items-center gap-3.5 rounded-row bg-surface px-4 py-3.5 transition-opacity duration-300",
        done && "opacity-70",
        className
      )}
    >
      <Checkbox checked={done} onCheckedChange={onDoneChange} label={title} />
      {onOpen ? (
        // fills the rest of the row (out to its edges) so the whole thing is the tap target
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Edit ${title}`}
          className="-my-3.5 -mr-4 flex min-w-0 flex-1 items-center gap-3.5 self-stretch rounded-r-row py-3.5 pr-4 text-left outline-offset-[-2px]"
        >
          {body}
        </button>
      ) : (
        body
      )}
    </div>
  );
}
