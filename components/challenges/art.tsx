"use client";

import { useId, useMemo } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * The streak flame (amber to coral, with a yellow core). `cold` greys it out for a streak that's slipping;
 * `flicker` makes it breathe gently.
 */
export function Flame({ cold = false, flicker = false, className }: { cold?: boolean; flicker?: boolean; className?: string }) {
  const id = useId();
  const [a, b, c, d] = cold ? ["#D9D2CB", "#B5ACA5", "#EFEAE4", "#D9D2CB"] : ["#FFB238", "#FF6B4A", "#FFE27A", "#FFC24A"];
  return (
    <motion.svg
      viewBox="0 0 64 80"
      aria-hidden
      className={cn("origin-bottom", className)}
      animate={flicker ? { scaleY: [1, 1.06, 0.98, 1.04, 1], rotate: [0, -2, 0, 2, 0] } : undefined}
      transition={flicker ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" } : undefined}
    >
      <defs>
        <linearGradient id={`${id}o`} x1="32" y1="2" x2="32" y2="78" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
        <linearGradient id={`${id}i`} x1="32" y1="40" x2="32" y2="76" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={c} />
          <stop offset="1" stopColor={d} />
        </linearGradient>
      </defs>
      <path d="M32 2C34 16 50 24 54 42C58 62 46 78 32 78C18 78 6 66 8 48C9 38 15 32 18 26C20 34 24 38 28 38C26 26 28 12 32 2Z" fill={`url(#${id}o)`} />
      <path d="M32 40C34 48 42 52 42 62C42 70 37 76 32 76C26 76 22 71 22 64C22 56 28 52 28 46C30 48 31 46 32 40Z" fill={`url(#${id}i)`} />
    </motion.svg>
  );
}

/** A streak booster: a periwinkle shield with a bolt. `empty` is a free slot. */
export function BoosterShield({ empty = false, bolt = true, className }: { empty?: boolean; bolt?: boolean; className?: string }) {
  const id = useId();
  const [a, b] = empty ? ["#E7E2DC", "#D3CCC5"] : ["#8F9BFF", "#5563F0"];
  return (
    <svg viewBox="0 0 64 76" aria-hidden className={className}>
      <defs>
        <linearGradient id={id} x1="32" y1="4" x2="32" y2="74" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
      </defs>
      <path d="M32 4L56 12V36C56 54 44 68 32 74C20 68 8 54 8 36V12L32 4Z" fill={`url(#${id})`} />
      <path d="M32 9L51 15.5V36C51 50.5 41.5 62 32 67.5" stroke="#fff" strokeOpacity="0.35" strokeWidth="3" strokeLinecap="round" fill="none" />
      {bolt ? <path d="M35 18L22 40H31L28 58L42 34H33L35 18Z" fill="#fff" /> : null}
    </svg>
  );
}

/** A four-point twinkle */
export function Sparkle({ className, delay = 0 }: { className?: string; delay?: number }) {
  return (
    <motion.svg
      viewBox="0 0 24 24"
      aria-hidden
      className={cn("absolute", className)}
      initial={{ scale: 0, rotate: -30 }}
      animate={{ scale: [0, 1.2, 0.85, 1], rotate: 0 }}
      transition={{ duration: 0.9, delay, ease: "easeOut" }}
    >
      <path d="M12 0C13 7 17 11 24 12C17 13 13 17 12 24C11 17 7 13 0 12C7 11 11 7 12 0Z" fill="currentColor" />
    </motion.svg>
  );
}

const CONFETTI_COLOURS = ["#FF6B4A", "#FFB238", "#6C7BFF", "#2FA572", "#FFC24A", "#FF8FB1"];

/** where each bit of confetti flies: a seeded shuffle, so a burst looks the same on every render */
function confettiBits(count: number, seed: number) {
  let s = seed;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  return Array.from({ length: count }, (_, i) => {
    const angle = rnd() * Math.PI * 2;
    const dist = 90 + rnd() * 140;
    return {
      i,
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist * 0.8,
      fall: 120 + rnd() * 160,
      rotate: rnd() * 540 - 270,
      colour: CONFETTI_COLOURS[Math.floor(rnd() * CONFETTI_COLOURS.length)],
      round: rnd() > 0.55,
      w: 5 + rnd() * 5,
      h: 8 + rnd() * 8,
      wait: rnd() * 0.12,
    };
  });
}

/** A burst of confetti from the middle of its box that drifts down and fades. Decorative. */
export function Confetti({ count = 48, seed = 1, delay = 0, className }: { count?: number; seed?: number; delay?: number; className?: string }) {
  const bits = useMemo(() => confettiBits(count, seed), [count, seed]);

  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-visible", className)}>
      {bits.map((b) => (
        <motion.span
          key={b.i}
          className="absolute top-1/2 left-1/2"
          style={{ width: b.w, height: b.round ? b.w : b.h, backgroundColor: b.colour, borderRadius: b.round ? 999 : 2 }}
          initial={{ x: 0, y: 0, scale: 0.3, opacity: 0, rotate: 0 }}
          animate={{
            x: [0, b.x, b.x * 1.1],
            y: [0, b.y, b.y + b.fall],
            scale: [0.3, 1, 1],
            opacity: [0, 1, 0],
            rotate: [0, b.rotate * 0.5, b.rotate],
          }}
          transition={{ duration: 2.2, delay: delay + b.wait, times: [0, 0.25, 1], ease: ["easeOut", "easeIn"] }}
        />
      ))}
    </div>
  );
}
