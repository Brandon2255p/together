"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setMyName } from "@/lib/actions/profile";
import { browserBackend } from "@/lib/backend/browser";
import type { Member, Together } from "@/lib/models";

export function useProfileViewModel(together: Together) {
  const router = useRouter();
  const found = together.members.find((m) => m.id === together.meId);
  const [saved, setSaved] = useState(found?.name ?? "");
  const [name, setName] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const clean = name.trim().replace(/\s+/g, " ");
  const me: Member = {
    id: together.meId,
    tone: found?.tone ?? "accent",
    role: found?.role ?? "member",
    name: clean || saved,
    initial: (clean || saved).charAt(0).toUpperCase() || "?",
  };

  async function onSave() {
    if (!clean || clean === saved || saving) return;
    const previous = saved;
    // optimistic: the new name shows straight away, and goes back if saving fails
    setSaved(clean);
    setName(clean);
    setSaving(true);
    setError(null);
    const result = await setMyName(clean);
    setSaving(false);
    if (!result.success) {
      setSaved(previous);
      setError(result.error ?? "We couldn't change your name. Try again.");
      return;
    }
    setNote("Saved ✓");
    setTimeout(() => setNote(null), 2000);
    router.refresh();
  }

  async function onSignOut() {
    setSigningOut(true);
    const { error: signOutError } = await browserBackend.signOut();
    if (signOutError) {
      setSigningOut(false);
      setError(signOutError.message);
      return;
    }
    router.replace("/sign-in");
    router.refresh();
  }

  return {
    me,
    togetherName: together.name,
    name,
    onNameChange: (value: string) => {
      setName(value.slice(0, 40));
      setError(null);
    },
    canSave: clean.length > 0 && clean !== saved,
    saving,
    note,
    onSave: () => void onSave(),
    signingOut,
    onSignOut: () => void onSignOut(),
    backHref: "/home" as const,
    error,
  };
}
