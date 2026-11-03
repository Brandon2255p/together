"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TogetherChoice } from "@/components/onboarding/together-screen";
import { createTogether, joinTogether } from "@/lib/actions/together";

export function useTogetherOnboardingViewModel() {
  const router = useRouter();
  const [choice, setChoice] = useState<TogetherChoice>("create");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onContinue() {
    setPending(true);
    setError(null);
    if (choice === "create") {
      const result = await createTogether("Our Together");
      if (!result.data) {
        setPending(false);
        return setError(result.error ?? "Couldn't create it. Try again.");
      }
      router.push("/onboarding/invite");
    } else {
      const result = await joinTogether(code);
      if (!result.data) {
        setPending(false);
        return setError(result.error ?? "Couldn't join. Try again.");
      }
      router.replace("/home");
    }
  }

  return {
    choice,
    onChoiceChange: (c: TogetherChoice) => {
      setChoice(c);
      setError(null);
    },
    code,
    onCodeChange: setCode,
    onContinue: () => void onContinue(),
    pending,
    error,
  };
}
