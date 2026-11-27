"use client";

import Link, { useLinkStatus, type LinkProps } from "next/link";
import { LoaderCircleIcon } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

/** how long a navigation may take before the link shows it's pending: quicker ones don't flicker */
const SHOW_AFTER_S = 0.12;

/** A tint over the link (cards, rows, round buttons), the link's own shape, breathing while the next screen loads */
function PendingTint() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <motion.span
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-[inherit] bg-current/10"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 0.6, 1] }}
      transition={{ delay: SHOW_AFTER_S, duration: 1.2, repeat: Infinity, repeatType: "reverse" }}
    />
  );
}

/** A small spinner after the text (text links like "See all" or "‹ Home") */
function PendingSpinner() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <motion.span aria-hidden className="inline-flex" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: SHOW_AFTER_S }}>
      <LoaderCircleIcon className="ml-1 size-3.5 animate-spin" />
    </motion.span>
  );
}

export type NavLinkProps<T> = LinkProps<T> & {
  /** "tint" (the default) for cards, rows and icon buttons; "spinner" for text links */
  pending?: "tint" | "spinner";
};

/**
 * A link to another screen that answers the tap: if the next screen isn't there within a moment (a slow network, or
 * its skeleton wasn't prefetched yet), the link shows it's on its way, so nobody taps again and starts it over. Use it
 * for every link between screens instead of next/link.
 */
export function NavLink<T>({ pending = "tint", className, children, ...props }: NavLinkProps<T>) {
  return (
    <Link {...props} className={cn(pending === "tint" && "relative", className)}>
      {children}
      {pending === "tint" ? <PendingTint /> : <PendingSpinner />}
    </Link>
  );
}
