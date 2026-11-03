"use client";

import { useEffect } from "react";
import { AnimatePresence, motion, useDragControls } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * A bottom sheet over a dimmed screen. Controlled by `open`; closes on the scrim, Escape, or dragging it down.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  eyebrow,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const drag = useDragControls();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onOpenChange(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 mx-auto max-w-[440px]">
          <motion.div
            className="absolute inset-0 bg-ink/35"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cn(
              "absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col gap-5 overflow-y-auto rounded-t-sheet bg-surface px-5 pt-3 pb-[max(2rem,env(safe-area-inset-bottom))]",
              className
            )}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
            drag="y"
            dragControls={drag}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onOpenChange(false);
            }}
          >
            <div
              className="flex cursor-grab touch-none justify-center py-1 active:cursor-grabbing"
              onPointerDown={(e) => drag.start(e)}
            >
              <span className="h-[5px] w-10 rounded-full bg-line" />
            </div>
            <div className="flex flex-col gap-1">
              {eyebrow ? <p className="text-overline text-accent-ink">{eyebrow}</p> : null}
              <h2 className="text-display-l">{title}</h2>
            </div>
            {children}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
