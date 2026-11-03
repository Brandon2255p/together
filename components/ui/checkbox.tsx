"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

/** The round tick used by chores and shopping items. Controlled; animates the tick in. */
export function Checkbox({
  checked,
  onCheckedChange,
  label,
  className,
}: {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** accessible name, e.g. the item's title */
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        "relative grid size-[26px] shrink-0 place-items-center rounded-full transition-colors duration-200",
        "before:absolute before:-inset-2.5 before:content-['']", // 46px touch target
        checked ? "bg-success" : "border-2 border-ink-subtle hover:border-ink-muted",
        className
      )}
    >
      <motion.svg
        viewBox="0 0 24 24"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={false}
        animate={{ scale: checked ? 1 : 0.4, opacity: checked ? 1 : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 25 }}
        aria-hidden
      >
        <motion.path
          d="M20 6 9 17l-5-5"
          className="text-on-accent"
          initial={false}
          animate={{ pathLength: checked ? 1 : 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        />
      </motion.svg>
    </button>
  );
}
