"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserBackend } from "@/lib/backend/browser";
import { rememberEmail, rememberNext } from "../email";

/** `next`: a join link to come back to after signing in */
export function useSignInViewModel(next: string | null = null) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setError("That doesn't look like an email address.");
      return;
    }
    setPending(true);
    setError(null);
    const { error: sendError } = await browserBackend.signInWithOtp({ email: address });
    setPending(false);
    if (sendError) {
      setError(sendError.message);
      return;
    }
    rememberEmail(address);
    rememberNext(next);
    router.push("/verify");
  }

  return {
    email,
    onEmailChange: (value: string) => {
      setEmail(value);
      setError(null);
    },
    onSubmit,
    pending,
    error,
  };
}
