"use client";

import Link from "next/link";
import type { Route } from "next";
import { ChevronLeftIcon, LogOutIcon, UserRoundIcon } from "lucide-react";
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
}

export function ProfileScreen(props: ProfileScreenProps) {
  const { me, togetherName, name, onNameChange, canSave, saving, note, onSave, signingOut, onSignOut, backHref, error } = props;
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

      <RevealItem>
        <Button block variant="ghost" onClick={onSignOut} pending={signingOut}>
          <LogOutIcon className="size-4" aria-hidden />
          Sign out
        </Button>
      </RevealItem>
    </Reveal>
  );
}
