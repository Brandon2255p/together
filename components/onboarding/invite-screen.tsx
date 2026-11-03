"use client";

import { HeartIcon, PlusIcon, XIcon } from "lucide-react";
import { motion } from "motion/react";
import type { Member } from "@/lib/models";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { InlineError } from "@/components/ui/layout";
import { Orb } from "@/components/ui/orb";
import { TextField } from "@/components/ui/text-field";

export interface InviteScreenProps {
  me: Member;
  name: string;
  onNameChange: (name: string) => void;
  onNameCommit: () => void;
  /** formatted for reading aloud, e.g. "K7Q · 29X" */
  inviteCode: string;
  onShare: () => void;
  /** "Link copied" after sharing falls back to the clipboard */
  shareNote: string | null;
  onDone: () => void;
  error: string | null;
}

export function InviteScreen(props: InviteScreenProps) {
  const { me, name, onNameChange, onNameCommit, inviteCode, onShare, shareNote, onDone, error } = props;
  return (
    <main className="relative flex min-h-dvh flex-col gap-6 overflow-hidden px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <Orb palette="warm" className="absolute top-12 left-1/2 size-[280px] -translate-x-1/2 opacity-80" />
      <IconButton label="Close" onClick={onDone} className="relative">
        <XIcon />
      </IconButton>

      <div className="relative flex justify-center -space-x-4 pt-2">
        <Avatar member={me} size="xl" />
        <motion.span
          className="grid size-[84px] place-items-center rounded-full border-2 border-dashed border-ink-subtle bg-surface text-ink-muted"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          aria-label="Waiting for your person to join"
          role="img"
        >
          <PlusIcon className="size-7" aria-hidden />
        </motion.span>
      </div>

      <div className="relative flex flex-col items-center gap-2 text-center">
        <h1 className="text-display-l">Invite your person</h1>
        <p className="text-body text-ink-muted">
          Share this code. Once they sign in and enter it, your Together is ready.
        </p>
      </div>

      <TextField
        label="Name your Together"
        icon={<HeartIcon aria-hidden />}
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        onBlur={onNameCommit}
      />

      <div className="flex flex-col items-center gap-1.5 rounded-card bg-surface py-6 shadow-card">
        <p className="text-overline text-ink-muted">Your invite code</p>
        <p className="text-display-xl tracking-[2px]">{inviteCode}</p>
        <p className="text-caption font-normal text-ink-muted">Expires in 48 hours</p>
      </div>
      <InlineError>{error}</InlineError>

      <div className="flex-1" />
      <div className="flex flex-col gap-2">
        <Button block onClick={onShare}>
          {shareNote ?? "Share invite link"}
        </Button>
        <Button block variant="ghost" onClick={onDone}>
          I&apos;ll do this later
        </Button>
      </div>
    </main>
  );
}
