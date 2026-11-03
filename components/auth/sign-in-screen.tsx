"use client";

import { MailIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/layout";
import { Reveal, RevealItem } from "@/components/ui/motion";
import { Orb } from "@/components/ui/orb";
import { TextField } from "@/components/ui/text-field";

export interface SignInScreenProps {
  email: string;
  onEmailChange: (email: string) => void;
  onSubmit: () => void;
  pending: boolean;
  error: string | null;
}

export function SignInScreen({ email, onEmailChange, onSubmit, pending, error }: SignInScreenProps) {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <Orb className="absolute -top-10 -left-16 size-[420px]" />
      <div className="flex-1" />
      <Reveal className="relative flex flex-col gap-6">
        <RevealItem>
          <p className="font-display text-[28px] italic leading-none">together</p>
        </RevealItem>
        <RevealItem className="flex flex-col gap-3">
          <h1 className="text-display-xl">
            Life is better
            <br />
            shared.
          </h1>
          <p className="text-body text-ink-muted">
            One calm place for your lists, plans, places and wishes — for the two of you.
          </p>
        </RevealItem>
        <RevealItem>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}
          >
            <TextField
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              icon={<MailIcon aria-hidden />}
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
            />
            <InlineError>{error}</InlineError>
            <Button type="submit" block pending={pending}>
              Send me a code
            </Button>
            <p className="text-center text-caption font-normal text-ink-muted">
              We&apos;ll email a 6-digit code. No passwords, ever.
            </p>
          </form>
        </RevealItem>
      </Reveal>
    </main>
  );
}
