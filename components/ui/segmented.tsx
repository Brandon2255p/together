"use client";

import { useId } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
}

/** Two to four mutually exclusive options. The white pill slides between them. */
export function Segmented<T extends string>({
  options,
  value,
  onValueChange,
  label,
  size = "md",
  className,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  /** accessible name for the group */
  label: string;
  size?: "md" | "sm";
  className?: string;
}) {
  const id = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("flex gap-1 rounded-full bg-surface-muted p-1", className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "relative flex-1 rounded-full transition-colors duration-200",
              size === "md" ? "py-2.5 text-callout" : "py-2 text-caption",
              selected ? "text-ink" : "text-ink-muted hover:text-ink"
            )}
          >
            {selected ? (
              <motion.span
                layoutId={`segmented-${id}`}
                className="absolute inset-0 rounded-full bg-surface shadow-card"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            ) : null}
            <span className="relative">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
