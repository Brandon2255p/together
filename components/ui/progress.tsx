"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

/** A rounded progress track; the fill springs in when it first shows */
export function Progress({ value, label, className }: { value: number; label: string; className?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn("h-2.5 overflow-hidden rounded-full bg-surface-muted", className)}
    >
      <motion.div
        className="h-full rounded-full bg-accent"
        initial={{ width: 0 }}
        whileInView={{ width: `${pct}%` }}
        viewport={{ once: true }}
        transition={{ type: "spring", stiffness: 60, damping: 16, delay: 0.15 }}
      />
    </div>
  );
}
