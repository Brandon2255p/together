"use client";

import Link from "next/link";
import type { Route } from "next";
import type { InvitePreview } from "@/lib/models";
import { AvatarStack } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { InlineError } from "@/components/ui/layout";
import { Orb } from "@/components/ui/orb";

export interface JoinScreenProps {
  /** null when the code doesn't match any Together */
  invite: InvitePreview | null;
  /** "K7Q · 29X" */
  code: string;
  onJoin: () => void;
  pending: boolean;
  error: string | null;
  /** where to go instead: Home, or onboarding for someone without a Together */
  elsewhere: { href: Route; label: string };
}

/** The join link (/join/CODE) from screen 16: who's inviting you, and a Join button */
export function JoinScreen({ invite, code, onJoin, pending, error, elsewhere }: JoinScreenProps) {
  const people = invite?.members.map((m) => m.name) ?? [];
  const names = people.length <= 2 ? people.join(" and ") : `${people.slice(0, 2).join(", ")} and ${people.length - 2} more`;
  return (
    <main className="relative mx-auto flex min-h-dvh max-w-[440px] flex-col gap-6 overflow-hidden px-5 pt-[max(3rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <Orb palette="together" className="absolute top-6 left-1/2 size-[300px] -translate-x-1/2 opacity-70" />
      <div className="relative flex flex-col items-center gap-4 pt-24 text-center">
        {invite ? (
          <>
            <AvatarStack members={invite.members.slice(0, 4)} size="lg" />
            <p className="text-overline text-ink-muted">You&apos;re invited to</p>
            <h1 className="text-display-xl text-balance">{invite.name}</h1>
            {names ? <p className="text-body text-ink-muted">with {names}</p> : null}
          </>
        ) : (
          <>
            <h1 className="text-display-l">That link didn&apos;t work</h1>
            <p className="text-body text-ink-muted">
              The code {code} doesn&apos;t match a Together. It may have been replaced with a new one. Ask whoever sent it.
            </p>
          </>
        )}
      </div>
      <div className="flex-1" />
      <div className="relative flex flex-col gap-2">
        <InlineError>{error}</InlineError>
        {invite && invite.alreadyMember ? (
          <Button block onClick={onJoin} pending={pending}>
            You&apos;re in. Open {invite.name}
          </Button>
        ) : invite && invite.expired ? (
          <p className="rounded-2xl bg-surface px-4 py-3 text-center text-callout text-ink-muted">
            This invite has expired. Ask for a new one.
          </p>
        ) : invite ? (
          <Button block onClick={onJoin} pending={pending}>
            Join {invite.name}
          </Button>
        ) : null}
        <Link href={elsewhere.href} className={buttonVariants({ variant: "ghost", block: true })}>
          {elsewhere.label}
        </Link>
      </div>
    </main>
  );
}
