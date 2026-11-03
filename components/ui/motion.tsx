"use client";

import { motion, type HTMLMotionProps } from "motion/react";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 260, damping: 26 } },
};

/** Fades its <RevealItem> children up one after another when the screen opens */
export function Reveal(props: HTMLMotionProps<"div">) {
  return <motion.div variants={container} initial="hidden" animate="show" {...props} />;
}

export function RevealItem(props: HTMLMotionProps<"div">) {
  return <motion.div variants={item} {...props} />;
}

/** A list item that animates in, out, and to its new place when the list changes (wrap the list in AnimatePresence) */
export function ListItem(props: HTMLMotionProps<"li">) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, transition: { duration: 0.18 } }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      {...props}
    />
  );
}
