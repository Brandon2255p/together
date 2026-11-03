"use client";

import { OTPInput, REGEXP_ONLY_DIGITS } from "input-otp";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

/** Six digit boxes for the emailed sign-in code. Controlled. */
export function OtpInput({
  value,
  onChange,
  onComplete,
  invalid,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  invalid?: boolean;
  disabled?: boolean;
}) {
  return (
    <OTPInput
      maxLength={6}
      value={value}
      onChange={onChange}
      onComplete={onComplete}
      pattern={REGEXP_ONLY_DIGITS}
      autoFocus
      disabled={disabled}
      aria-label="6-digit code"
      containerClassName="w-full"
      render={({ slots }) => (
        <motion.div
          className="flex w-full gap-2"
          animate={invalid ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
          transition={{ duration: 0.4 }}
        >
          {slots.map((slot, i) => (
            <div
              key={i}
              className={cn(
                "relative flex h-16 flex-1 items-center justify-center rounded-[18px] border bg-surface text-display-l transition-[border-color,box-shadow] duration-150",
                slot.isActive ? "border-ink shadow-[0_0_0_1px_var(--color-ink)]" : "border-line",
                invalid && "border-accent"
              )}
            >
              {slot.char ? (
                <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 500, damping: 22 }}>
                  {slot.char}
                </motion.span>
              ) : null}
              {slot.hasFakeCaret ? <span className="h-7 w-0.5 animate-pulse bg-accent" /> : null}
            </div>
          ))}
        </motion.div>
      )}
    />
  );
}
