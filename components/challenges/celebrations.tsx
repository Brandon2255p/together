"use client";

import { useEffect } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { CheckIcon } from "lucide-react";
import { BoosterShield, Confetti, Flame, Sparkle } from "@/components/challenges/art";
import { cn } from "@/lib/utils";

/** a period in the strip of recent ones */
export interface RecentPeriod {
  key: string;
  label: string;
  state: "done" | "boosted" | "missed" | "now" | "next";
}

export type Celebration =
  | {
      kind: "complete";
      /** "Week complete!" */
      heading: string;
      /** "Gym together · all 3 goals" */
      detail: string;
      goals: { title: string; progress: string }[];
    }
  | {
      kind: "streak";
      from: number;
      to: number;
      /** "week streak!" */
      noun: string;
      recent: RecentPeriod[];
      message: string;
      /** "Booster earned for 5 in a row", when one was */
      booster: string | null;
    }
  | { kind: "booster"; heading: string; message: string; held: number; max: number }
  | { kind: "saved"; message: string; recent: RecentPeriod[]; held: number; max: number };

const spring = { type: "spring" as const, stiffness: 320, damping: 18 };
const rise = (delay: number) => ({ initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { delay, type: "spring" as const, stiffness: 260, damping: 24 } });

function Strip({ recent, dark, highlight }: { recent: RecentPeriod[]; dark?: boolean; highlight: RecentPeriod["state"] }) {
  return (
    <motion.ol {...rise(1.3)} className={cn("flex justify-between gap-1 rounded-3xl p-3.5", dark ? "bg-white/7" : "bg-white/15")}>
      {recent.map((p) => {
        const lit = p.state === highlight;
        return (
          <li key={p.key} className="flex flex-col items-center gap-1.5">
            <motion.span
              className={cn(
                "grid size-11 place-items-center rounded-full",
                p.state === "next" ? "border-2 border-dashed border-white/30" : "bg-white/12",
                lit && highlight === "now" && "border-2 border-[#FFB238] bg-accent/35 shadow-[0_0_18px_rgb(255_140_51/0.7)]",
                lit && highlight === "boosted" && "border-2 border-[#C9CFFF] bg-partner/45 shadow-[0_0_18px_rgb(143_155_255/0.8)]"
              )}
              initial={lit ? { scale: 0.2 } : false}
              animate={lit ? { scale: [0.2, 1.15, 1] } : undefined}
              transition={lit ? { delay: 1.6, duration: 0.6, times: [0, 0.6, 1] } : undefined}
            >
              {p.state === "done" || p.state === "now" ? <Flame className="h-6 w-5" /> : null}
              {p.state === "boosted" ? <BoosterShield className="h-6 w-5" /> : null}
              {p.state === "missed" ? <span className="text-callout text-white/40">✕</span> : null}
            </motion.span>
            <span className="text-caption text-white/70">{p.label}</span>
          </li>
        );
      })}
    </motion.ol>
  );
}

function Rays({ colour }: { colour: string }) {
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute top-[-60px] left-1/2 size-[520px] -translate-x-1/2"
      initial={{ opacity: 0, rotate: 0 }}
      animate={{ opacity: 1, rotate: 40 }}
      transition={{ opacity: { duration: 0.6 }, rotate: { duration: 24, ease: "linear", repeat: Infinity } }}
    >
      {Array.from({ length: 12 }, (_, i) => (
        <span key={i} className="absolute top-0 left-1/2 h-1/2 w-2.5 -translate-x-1/2 origin-bottom rounded-full" style={{ rotate: `${i * 30}deg`, background: colour }} />
      ))}
    </motion.div>
  );
}

function Complete({ c }: { c: Extract<Celebration, { kind: "complete" }> }) {
  return (
    <div className="flex min-h-full flex-col bg-bg px-5 pt-16 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="relative mx-auto mt-6 grid size-44 place-items-center">
        <span aria-hidden className="absolute -inset-24 -z-0 rounded-full bg-[radial-gradient(circle,var(--color-success-soft)_0%,transparent_65%)]" />
        <Confetti seed={3} delay={0.4} count={56} />
        <motion.svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="50" cy="50" r="44" fill="none" stroke="var(--color-success-soft)" strokeWidth="8" />
          <motion.circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke="var(--color-success)"
            strokeWidth="8"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          />
        </motion.svg>
        <motion.span
          className="relative grid size-28 place-items-center rounded-full bg-success text-on-accent shadow-[0_10px_28px_rgb(47_165_114/0.35)]"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ ...spring, delay: 0.45 }}
        >
          <motion.span initial={{ scale: 0, rotate: 25 }} animate={{ scale: 1, rotate: 0 }} transition={{ ...spring, delay: 0.65 }}>
            <CheckIcon className="size-14" strokeWidth={3} aria-hidden />
          </motion.span>
        </motion.span>
        <Sparkle className="-top-1 right-0 size-6 text-[#FFB238]" delay={0.7} />
        <Sparkle className="bottom-6 -left-4 size-4 text-partner" delay={0.9} />
      </div>
      <motion.h2 {...rise(0.8)} className="mt-10 text-center text-display-xl">
        {c.heading}
      </motion.h2>
      <motion.p {...rise(0.95)} className="mt-2 text-center text-body text-ink-muted">
        {c.detail}
      </motion.p>
      <motion.ul {...rise(1.1)} className="mt-8 flex flex-col gap-3 rounded-card bg-surface p-4 shadow-card">
        {c.goals.map((g, i) => (
          <li key={g.title} className="flex items-center gap-3">
            <motion.span
              className="grid size-6 shrink-0 place-items-center rounded-full bg-success text-on-accent"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ ...spring, delay: 1.3 + i * 0.15 }}
            >
              <CheckIcon className="size-4" strokeWidth={3} aria-hidden />
            </motion.span>
            <span className="flex-1 text-callout">{g.title}</span>
            <span className="text-caption font-semibold text-success-ink">{g.progress}</span>
          </li>
        ))}
      </motion.ul>
    </div>
  );
}

function Streak({ c }: { c: Extract<Celebration, { kind: "streak" }> }) {
  return (
    <div className="relative flex min-h-full flex-col overflow-hidden bg-linear-to-b from-ink via-[#2E1D16] to-[#4A2416] px-5 pt-16 pb-[max(2rem,env(safe-area-inset-bottom))] text-on-accent">
      <Rays colour="rgb(255 178 56 / 0.07)" />
      <motion.span
        aria-hidden
        className="absolute top-10 left-1/2 size-96 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgb(255_138_61/0.7)_0%,rgb(255_107_74/0.22)_40%,transparent_70%)]"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: [0.5, 1, 1.08, 1] }}
        transition={{ duration: 2.6, times: [0, 0.3, 0.6, 1] }}
      />
      <div className="relative mx-auto mt-4 h-48 w-40">
        <motion.div
          className="h-full w-full origin-bottom"
          initial={{ scale: 0.15, opacity: 0 }}
          animate={{ scale: [0.15, 1.18, 1], opacity: 1, rotate: [0, 0, -5, 4, -2, 0] }}
          transition={{ scale: { duration: 0.75, times: [0, 0.6, 1] }, opacity: { duration: 0.15 }, rotate: { delay: 0.75, duration: 0.8 } }}
        >
          <Flame flicker className="h-full w-full" />
        </motion.div>
        <Sparkle className="top-6 -left-6 size-5 text-[#FFE27A]" delay={0.5} />
        <Sparkle className="top-16 -right-8 size-7 text-[#FFB238]" delay={0.75} />
        <Sparkle className="-top-2 right-0 size-3.5 text-white" delay={1} />
      </div>
      <div className="relative mx-auto h-[110px] w-full overflow-hidden text-center font-display text-[120px] leading-[110px]" aria-live="polite">
        <motion.span className="absolute inset-0" initial={{ y: 0, opacity: 1 }} animate={{ y: -90, opacity: 0 }} transition={{ delay: 0.65, duration: 0.35, ease: "easeIn" }} aria-hidden>
          {c.from}
        </motion.span>
        <motion.span className="absolute inset-0" initial={{ y: 90, opacity: 0 }} animate={{ y: 0, opacity: 1, scale: [1, 1, 1.12, 1] }} transition={{ delay: 0.7, y: { type: "spring", stiffness: 300, damping: 16, delay: 0.7 }, scale: { delay: 1.05, duration: 0.4 } }}>
          {c.to}
        </motion.span>
      </div>
      <motion.p {...rise(1.1)} className="text-center text-title text-[26px]">
        {c.noun}
      </motion.p>
      <div className="mt-6">
        <Strip recent={c.recent} dark highlight="now" />
      </div>
      <motion.p {...rise(1.9)} className="mt-6 text-center text-callout text-white/90">
        {c.message}
      </motion.p>
      {c.booster ? (
        <motion.p
          className="mx-auto mt-5 flex items-center gap-2 rounded-full bg-partner/25 py-2.5 pr-4 pl-3 text-caption font-semibold"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...spring, delay: 2.1 }}
        >
          <BoosterShield className="h-6 w-5" />
          {c.booster}
        </motion.p>
      ) : null}
    </div>
  );
}

function Booster({ c }: { c: Extract<Celebration, { kind: "booster" }> }) {
  return (
    <div className="relative flex min-h-full flex-col overflow-hidden bg-linear-to-b from-bg to-partner-soft px-5 pt-16 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <Rays colour="rgb(255 255 255 / 0.5)" />
      <span aria-hidden className="absolute top-14 left-1/2 size-96 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,#C9CFFF_0%,rgb(231_234_255/0.5)_50%,transparent_70%)]" />
      <div className="relative mx-auto mt-8 h-44 w-36">
        <Confetti seed={11} delay={0.35} count={30} />
        <motion.div
          className="h-full w-full"
          initial={{ y: 160, scale: 0.3, rotate: -14, opacity: 0 }}
          animate={{ y: [160, -16, 0], scale: [0.3, 1.12, 1], rotate: [-14, 6, 0], opacity: 1 }}
          transition={{ duration: 0.8, times: [0, 0.6, 1], opacity: { duration: 0.15 } }}
        >
          <BoosterShield className="h-full w-full drop-shadow-[0_12px_24px_rgb(85_99_240/0.35)]" />
        </motion.div>
        <Sparkle className="top-2 -left-8 size-6 text-partner" delay={0.5} />
        <Sparkle className="-top-4 -right-8 size-8 text-[#FFB238]" delay={0.7} />
      </div>
      <motion.h2 {...rise(0.8)} className="relative mt-10 text-center text-display-l text-[38px] leading-[42px]">
        {c.heading}
      </motion.h2>
      <motion.p {...rise(0.95)} className="relative mt-3 text-center text-body text-ink-muted">
        {c.message}
      </motion.p>
      <motion.div {...rise(1.1)} className="relative mx-auto mt-8 flex flex-col items-center gap-3 rounded-card bg-surface p-4 shadow-card">
        <span className="flex gap-3">
          {Array.from({ length: c.max }, (_, i) => {
            const isNew = i === c.held - 1;
            return (
              <motion.span
                key={i}
                className={cn("relative grid size-14 place-items-center rounded-[18px]", i < c.held ? "bg-partner-soft" : "bg-surface-muted", isNew && "ring-2 ring-partner")}
                initial={isNew ? { scale: 0.3 } : false}
                animate={isNew ? { scale: [0.3, 1.12, 1] } : undefined}
                transition={isNew ? { delay: 1.4, duration: 0.55 } : undefined}
              >
                <BoosterShield className="h-9 w-8" empty={i >= c.held} />
                {isNew ? (
                  <motion.span
                    className="absolute -top-2.5 -right-3 rounded-full bg-partner px-2 py-0.5 text-[10px] font-semibold tracking-wide text-on-accent"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ ...spring, delay: 1.9 }}
                  >
                    NEW
                  </motion.span>
                ) : null}
              </motion.span>
            );
          })}
        </span>
        <span className="text-caption text-ink-muted">
          {c.held} of {c.max} slots full
        </span>
      </motion.div>
    </div>
  );
}

function Saved({ c }: { c: Extract<Celebration, { kind: "saved" }> }) {
  return (
    <div className="relative flex min-h-full flex-col overflow-hidden bg-linear-to-b from-[#171A3D] via-[#232868] to-[#3A43A8] px-5 pt-16 pb-[max(2rem,env(safe-area-inset-bottom))] text-on-accent">
      <span aria-hidden className="absolute top-10 left-1/2 size-96 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgb(143_155_255/0.7)_0%,rgb(108_123_255/0.25)_45%,transparent_70%)]" />
      <div className="relative mx-auto mt-6 grid h-48 w-40 place-items-center">
        {[0, 1].map((i) => (
          <motion.span
            key={i}
            aria-hidden
            className="absolute size-60 rounded-full border-2 border-[#C9CFFF]/40"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: [0.6, 1.25], opacity: [0, 0.8, 0] }}
            transition={{ delay: 0.55 + i * 0.3, duration: 1.6, repeat: Infinity, repeatDelay: 0.6 }}
          />
        ))}
        <motion.div className="absolute inset-0" initial={{ y: -180 }} animate={{ y: 0, scale: [1, 1, 1.12, 1] }} transition={{ y: { duration: 0.5, ease: "easeIn" }, scale: { duration: 0.9, times: [0, 0.55, 0.7, 1] } }}>
          <BoosterShield bolt={false} className="h-full w-full" />
        </motion.div>
        <motion.div
          className="relative mt-4 h-24 w-20 origin-bottom"
          initial={{ scale: 1 }}
          animate={{ scale: [1, 0.85, 1.15, 1], rotate: [0, 0, 0, -4, 3, 0] }}
          transition={{ duration: 1.6, times: [0, 0.3, 0.5, 0.7, 0.85, 1] }}
        >
          <Flame flicker className="h-full w-full" />
        </motion.div>
        <Sparkle className="top-2 -left-8 size-5 text-[#C9CFFF]" delay={0.6} />
        <Sparkle className="top-10 -right-10 size-7 text-white" delay={0.8} />
      </div>
      <motion.h2 {...rise(0.9)} className="relative mt-10 text-center text-display-xl">
        Streak saved!
      </motion.h2>
      <motion.p {...rise(1.05)} className="relative mt-2 text-center text-body text-[#C9CFFF]">
        {c.message}
      </motion.p>
      <div className="relative mt-7">
        <Strip recent={c.recent} dark highlight="boosted" />
      </div>
      <motion.p {...rise(2)} className="relative mx-auto mt-6 flex items-center gap-2 rounded-full bg-white/10 py-2 pr-4 pl-3 text-caption font-semibold">
        <span className="flex -space-x-1">
          {Array.from({ length: c.max }, (_, i) => (
            <BoosterShield key={i} empty={i >= c.held} className="h-5 w-4" />
          ))}
        </span>
        {c.held === 1 ? "1 booster left" : `${c.held} boosters left`}
      </motion.p>
    </div>
  );
}

const BUTTONS: Record<Celebration["kind"], { label: string; className: string }> = {
  complete: { label: "Continue", className: "bg-ink text-on-accent" },
  streak: { label: "Keep it going", className: "bg-linear-to-r from-[#FF8A3D] to-accent text-on-accent" },
  booster: { label: "Nice!", className: "bg-linear-to-r from-[#8F9BFF] to-[#5563F0] text-on-accent" },
  saved: { label: "Back to it", className: "bg-surface text-partner-ink" },
};

/**
 * The full-screen moments after a period is done, the streak grows, a booster is earned or used. Shows one at a
 * time; `onNext` moves on (the view-model holds the queue).
 */
export function CelebrationOverlay({ celebration, onNext }: { celebration: Celebration | null; onNext: () => void }) {
  useEffect(() => {
    if (!celebration) return;
    // Enter and Space press the focused button already
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onNext();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [celebration, onNext]);

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait">
        {celebration ? (
          <motion.div
            key={celebration.kind}
            role="dialog"
            aria-modal="true"
            aria-label={celebration.kind === "complete" ? celebration.heading : celebration.kind === "streak" ? `${celebration.to} ${celebration.noun}` : celebration.kind === "booster" ? celebration.heading : "Streak saved"}
            className="fixed inset-0 z-[60] mx-auto flex max-w-[440px] flex-col overflow-y-auto"
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.25 }}
          >
            <div className="flex-1">
              {celebration.kind === "complete" ? <Complete c={celebration} /> : null}
              {celebration.kind === "streak" ? <Streak c={celebration} /> : null}
              {celebration.kind === "booster" ? <Booster c={celebration} /> : null}
              {celebration.kind === "saved" ? <Saved c={celebration} /> : null}
            </div>
            <div
              className={cn(
                "sticky bottom-0 px-5 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]",
                celebration.kind === "streak" ? "bg-[#4A2416]" : celebration.kind === "saved" ? "bg-[#3A43A8]" : celebration.kind === "booster" ? "bg-partner-soft" : "bg-bg"
              )}
            >
              <motion.button
                type="button"
                autoFocus
                onClick={onNext}
                className={cn("h-[54px] w-full rounded-full text-body-strong shadow-float transition-transform active:scale-[0.97]", BUTTONS[celebration.kind].className)}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: celebration.kind === "complete" ? 1.5 : 2.2 }}
              >
                {BUTTONS[celebration.kind].label}
              </motion.button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </MotionConfig>
  );
}
