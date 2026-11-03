"use client";

import { HeartIcon, LinkIcon, UsersIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { IconBadge, InlineError } from "@/components/ui/layout";
import { Reveal, RevealItem } from "@/components/ui/motion";
import { TextField } from "@/components/ui/text-field";
import { cn } from "@/lib/utils";

export type TogetherChoice = "create" | "join";

export interface TogetherScreenProps {
  choice: TogetherChoice;
  onChoiceChange: (choice: TogetherChoice) => void;
  code: string;
  onCodeChange: (code: string) => void;
  onContinue: () => void;
  pending: boolean;
  error: string | null;
}

function OptionCard({
  selected,
  onSelect,
  icon,
  tone,
  title,
  body,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  tone: "accent" | "partner";
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <motion.div
      animate={{ scale: selected ? 1.015 : 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className={cn(
        "flex flex-col gap-3.5 rounded-card p-5 transition-[background-color,box-shadow] duration-200",
        selected ? "bg-surface shadow-[0_0_0_1.5px_var(--color-ink)]" : "bg-surface"
      )}
    >
      <button type="button" role="radio" aria-checked={selected} onClick={onSelect} className="flex flex-col gap-3.5 text-left">
        <IconBadge tone={tone} size="lg" className={tone === "accent" ? "bg-accent text-on-accent" : "bg-partner text-on-accent"}>
          {icon}
        </IconBadge>
        <span className="flex flex-col gap-1">
          <span className="text-title">{title}</span>
          <span className="text-callout text-ink-muted">{body}</span>
        </span>
      </button>
      {children}
    </motion.div>
  );
}

export function TogetherScreen({ choice, onChoiceChange, code, onCodeChange, onContinue, pending, error }: TogetherScreenProps) {
  return (
    <main className="flex min-h-dvh flex-col gap-6 px-5 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <Reveal className="flex flex-col gap-6">
        <RevealItem className="flex flex-col gap-2">
          <p className="text-overline text-accent-ink">Welcome</p>
          <h1 className="text-display-l">
            Who are you
            <br />
            doing life with?
          </h1>
          <p className="text-body text-ink-muted">
            A Together is your shared space — a couple, a household, or the whole family.
          </p>
        </RevealItem>
        <RevealItem role="radiogroup" aria-label="Start or join" className="flex flex-col gap-4">
          <OptionCard
            selected={choice === "create"}
            onSelect={() => onChoiceChange("create")}
            icon={<HeartIcon />}
            tone="accent"
            title="Start a new Together"
            body="Create a space and invite your person."
          />
          <OptionCard
            selected={choice === "join"}
            onSelect={() => onChoiceChange("join")}
            icon={<UsersIcon />}
            tone="partner"
            title="Join with a code"
            body="Got an invite? Pop in the code."
          >
            <AnimatePresence initial={false}>
              {choice === "join" ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <TextField
                    label="Invite code"
                    placeholder="Invite code e.g. K7Q-29X"
                    autoCapitalize="characters"
                    autoComplete="one-time-code"
                    icon={<LinkIcon aria-hidden />}
                    value={code}
                    onChange={(e) => onCodeChange(e.target.value)}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </OptionCard>
        </RevealItem>
      </Reveal>
      <InlineError>{error}</InlineError>
      <div className="flex-1" />
      <Button block pending={pending} onClick={onContinue}>
        Continue
      </Button>
    </main>
  );
}
