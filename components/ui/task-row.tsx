"use client";

import { motion } from "motion/react";
import type { Member } from "@/lib/models";
import { AvatarStack } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

/**
 * A row with a round tick: chores, shopping items and calendar chores.
 * `meta` holds chips (due date, repeat). `people` are the assignees, or who added a shopping item.
 */
export function TaskRow({
  title,
  done,
  onDoneChange,
  meta,
  people = [],
  className,
}: {
  title: string;
  done: boolean;
  onDoneChange?: (done: boolean) => void;
  meta?: React.ReactNode;
  people?: Pick<Member, "id" | "name" | "initial" | "tone">[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3.5 rounded-row bg-surface px-4 py-3.5 transition-opacity duration-300",
        done && "opacity-70",
        className
      )}
    >
      <Checkbox checked={done} onCheckedChange={onDoneChange} label={title} />
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
    </div>
  );
}
