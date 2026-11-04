"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { browserBackend } from "@/lib/backend/browser";
import { getTogether } from "@/lib/actions/together";
import { recallEmail, recallNext } from "../email";

const RESEND_SECONDS = 30;
const noop = () => () => {};

export function useVerifyViewModel() {
  const router = useRouter();
  const email = useSyncExternalStore(noop, recallEmail, () => "");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  async function onSubmit() {
    if (code.length !== 6 || pending) return;
    if (!email) {
      router.replace("/sign-in");
      return;
    }
    setPending(true);
    setError(null);
    const { error: verifyError } = await browserBackend.verifyOtp({ email, token: code });
    if (verifyError) {
      setPending(false);
      setError(verifyError.message);
      setCode("");
      return;
    }
    const next = recallNext();
    if (next) return router.replace(next as Route);
    const together = await getTogether();
    router.replace(together.data ? "/home" : "/onboarding/together");
  }

  async function onResend() {
    if (!email) return router.replace("/sign-in");
    setResendIn(RESEND_SECONDS);
    setError(null);
    const { error: sendError } = await browserBackend.signInWithOtp({ email });
    if (sendError) setError(sendError.message);
  }

  return {
    email,
    code,
    onCodeChange: (value: string) => {
      setCode(value);
      setError(null);
    },
    onSubmit: () => void onSubmit(),
    onBack: () => router.back(),
    onResend: () => void onResend(),
    resendIn,
    pending,
    error,
  };
}
