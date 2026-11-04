"use client";

import Link from "next/link";
import type { Route } from "next";
import { BellIcon, BellOffIcon, ChevronLeftIcon, DownloadIcon, LogOutIcon, ShareIcon, UserRoundIcon } from "lucide-react";
import type { Member } from "@/lib/models";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { iconButtonVariants } from "@/components/ui/icon-button";
import { InlineError, ScreenHeader, SectionHeader } from "@/components/ui/layout";
import { Reveal, RevealItem } from "@/components/ui/motion";
import { TextField } from "@/components/ui/text-field";

export interface ProfileScreenProps {
  /** you, with the name as it's being typed */
  me: Member;
  togetherName: string;
  name: string;
  onNameChange: (name: string) => void;
  canSave: boolean;
  saving: boolean;
  /** "Saved ✓" for a moment after saving */
  note: string | null;
  onSave: () => void;
  signingOut: boolean;
  onSignOut: () => void;
  backHref: Route;
  error: string | null;
  reminders: "loading" | "on" | "off" | "unsupported" | "needs-install" | "denied" | "no-keys";
  remindersPending: boolean;
  onRemindersToggle: () => void;
  /** "prompt": the browser can install it with a tap; "ios": explain Share → Add to Home Screen */
  install: "prompt" | "ios" | null;
  onInstall: () => void;
}

const REMINDER_NOTES: Record<ProfileScreenProps["reminders"], string> = {
  loading: "",
  on: "We'll nudge this device in the morning when chores are due.",
  off: "A morning nudge on this device when chores are due.",
  unsupported: "This browser can't show reminders.",
  "needs-install": "Add Together to your Home Screen first, then turn reminders on there.",
  denied: "Notifications are blocked for Together. Allow them in your browser's settings, then come back.",
  "no-keys": "Reminders aren't set up on this server yet.",
};

export function ProfileScreen(props: ProfileScreenProps) {
  const { me, togetherName, name, onNameChange, canSave, saving, note, onSave, signingOut, onSignOut, backHref, error } = props;
  const { reminders, remindersPending, onRemindersToggle, install, onInstall } = props;
  const canToggle = reminders === "on" || reminders === "off";
  return (
    <Reveal className="flex flex-col gap-6">
      <RevealItem className="flex flex-col gap-4">
        <Link href={backHref} aria-label="Back to Home" className={iconButtonVariants({ variant: "surface" })}>
          <ChevronLeftIcon aria-hidden />
        </Link>
        <ScreenHeader eyebrow={togetherName} title="You" />
      </RevealItem>

      <RevealItem className="flex flex-col items-center gap-3 rounded-card bg-surface py-6 shadow-card">
        <Avatar member={me} size="xl" />
        <p className="text-title">{me.name}</p>
        <p className="text-caption text-ink-muted">This is how everyone in your Together sees you.</p>
      </RevealItem>

      <RevealItem>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            onSave();
          }}
        >
          <SectionHeader title="Your name" />
          <TextField
            label="Your name"
            icon={<UserRoundIcon aria-hidden />}
            value={name}
            maxLength={40}
            autoComplete="given-name"
            enterKeyHint="done"
            onChange={(e) => onNameChange(e.target.value)}
          />
          <InlineError>{error}</InlineError>
          <Button type="submit" block disabled={!canSave && !note} pending={saving}>
            {note ?? "Save name"}
          </Button>
        </form>
      </RevealItem>

      <RevealItem className="flex flex-col gap-3">
        <SectionHeader title="Reminders" />
        <div className="flex flex-col gap-3 rounded-card bg-surface p-4">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
              {reminders === "on" ? <BellIcon className="size-5" aria-hidden /> : <BellOffIcon className="size-5" aria-hidden />}
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-body-strong">Chores due today</span>
              <span className="text-caption text-ink-muted" aria-live="polite">
                {REMINDER_NOTES[reminders]}
              </span>
            </span>
          </div>
          {canToggle ? (
            <Button variant={reminders === "on" ? "outline" : "primary"} size="md" pending={remindersPending} onClick={onRemindersToggle}>
              {reminders === "on" ? "Turn off reminders" : "Turn on reminders"}
            </Button>
          ) : null}
        </div>
      </RevealItem>

      {install ? (
        <RevealItem className="flex flex-col gap-3">
          <SectionHeader title="On your phone" />
          <div className="flex flex-col gap-3 rounded-card bg-surface p-4">
            <span className="text-body-strong">Add Together to your Home Screen</span>
            {install === "prompt" ? (
              <>
                <span className="text-caption text-ink-muted">It opens full screen, like an app.</span>
                <Button size="md" variant="soft" onClick={onInstall}>
                  <DownloadIcon className="size-4" aria-hidden />
                  Install Together
                </Button>
              </>
            ) : (
              <span className="flex flex-wrap items-center gap-1 text-caption text-ink-muted">
                In Safari, tap Share <ShareIcon className="inline size-4" aria-label="(the share icon)" /> then “Add to Home Screen”.
              </span>
            )}
          </div>
        </RevealItem>
      ) : null}

      <RevealItem>
        <Button block variant="ghost" onClick={onSignOut} pending={signingOut}>
          <LogOutIcon className="size-4" aria-hidden />
          Sign out
        </Button>
      </RevealItem>
    </Reveal>
  );
}
