"use client";

import Link from "next/link";
import type { Route } from "next";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export interface TabBarItem<K extends string> {
  key: K;
  label: string;
  href: Route;
  icon: React.ReactNode;
}

/** The floating bottom navigation. Only the active tab shows its label. */
export function TabBar<K extends string>({
  items,
  active,
  className,
}: {
  items: TabBarItem<K>[];
  active: K | null;
  className?: string;
}) {
  return (
    <nav
      aria-label="Main"
      className={cn(
        "flex h-16 items-center justify-between rounded-full bg-surface p-2 shadow-float",
        className
      )}
    >
      {items.map((item) => {
        const selected = item.key === active;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={selected ? "page" : undefined}
            className={cn(
              "relative flex h-12 min-w-12 items-center justify-center gap-1.5 rounded-full px-3.5 [&_svg]:size-[22px]",
              selected ? "text-on-accent" : "text-ink-muted hover:text-ink"
            )}
          >
            {selected ? (
              <motion.span
                layoutId="tab-bar-pill"
                className="absolute inset-0 rounded-full bg-ink"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            ) : null}
            <span className="relative">{item.icon}</span>
            {selected ? (
              <motion.span
                className="relative text-caption"
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.08, duration: 0.2 }}
              >
                {item.label}
              </motion.span>
            ) : (
              <span className="sr-only">{item.label}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
