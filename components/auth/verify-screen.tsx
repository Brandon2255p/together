"use client";

import { ChevronLeftIcon, ClockIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { InlineError } from "@/components/ui/layout";
import { OtpInput } from "@/components/ui/otp-input";

export interface VerifyScreenProps {
  email: string;
  code: string;
  onCodeChange: (code: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  onResend: () => void;
  /** seconds until a new code can be sent; 0 shows the resend link */
  resendIn: number;
  pending: boolean;
  error: string | null;
}

export function VerifyScreen(props: VerifyScreenProps) {
  const { email, code, onCodeChange, onSubmit, onBack, onResend, resendIn, pending, error } = props;
  return (
    <main className="flex min-h-dvh flex-col gap-6 px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <IconButton label="Back" onClick={onBack}>
        <ChevronLeftIcon />
      </IconButton>
      <div className="flex flex-col gap-2">
        <h1 className="text-display-l">Check your inbox</h1>
        <p className="text-body text-ink-muted">
          Enter the code we sent to <span className="text-ink">{email || "your email"}</span>
        </p>
      </div>
      <form
        className="flex flex-1 flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <OtpInput value={code} onChange={onCodeChange} onComplete={onSubmit} invalid={!!error} disabled={pending} />
        <InlineError>{error}</InlineError>
        {resendIn > 0 ? (
          <p className="flex items-center gap-1.5 text-caption text-ink-muted">
            <ClockIcon className="size-4" aria-hidden />
            Resend code in 0:{String(resendIn).padStart(2, "0")}
          </p>
        ) : (
          <button type="button" onClick={onResend} className="w-fit text-caption text-ink underline underline-offset-4">
            Send a new code
          </button>
        )}
        <div className="flex-1" />
        <Button type="submit" block pending={pending} disabled={code.length !== 6}>
          Verify
        </Button>
      </form>
    </main>
  );
}
