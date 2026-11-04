"use client";

import { useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { joinTogether, switchTogether } from "@/lib/actions/together";
import type { InvitePreview } from "@/lib/models";
import { spacedCode } from "@/lib/together/invite";

export function useJoinViewModel({ code, invite, hasTogether }: { code: string; invite: InvitePreview | null; hasTogether: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clean = code.replace(/[^a-z0-9]/gi, "").toUpperCase();

  async function join() {
    if (!invite || pending) return;
    setPending(true);
    setError(null);
    // already in: just open it
    const result = invite.alreadyMember ? await switchTogether(invite.togetherId) : await joinTogether(clean);
    const failed = "success" in result ? !result.success : !result.data;
    if (failed) {
      setPending(false);
      return setError(result.error ?? "We couldn't join that Together. Try again.");
    }
    router.replace("/home");
    router.refresh();
  }

  return {
    invite,
    code: spacedCode(clean),
    onJoin: () => void join(),
    pending,
    error,
    elsewhere: hasTogether
      ? { href: "/home" as Route, label: "Not now" }
      : { href: "/onboarding/together" as Route, label: "Start your own Together instead" },
  };
}
