"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { renameTogether } from "@/lib/actions/together";
import type { Member, Together } from "@/lib/models";

export function useInviteViewModel(together: Together) {
  const router = useRouter();
  const me = together.members.find((m) => m.id === together.meId) as Member;
  const [name, setName] = useState(together.name);
  const [saved, setSaved] = useState(together.name);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const code = together.inviteCode;

  async function onNameCommit() {
    if (name.trim() === saved) return;
    const result = await renameTogether(name);
    if (!result.success) return setError(result.error ?? "Couldn't rename it.");
    setSaved(name.trim());
    setError(null);
  }

  async function onShare() {
    const url = `${window.location.origin}/sign-in`;
    const text = `Join me on Together — sign in at ${url} and use the code ${code}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Join me on Together", text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setShareNote("Invite copied ✓");
      setTimeout(() => setShareNote(null), 2000);
    } catch {
      // the share sheet was dismissed
    }
  }

  return {
    me,
    name,
    onNameChange: setName,
    onNameCommit: () => void onNameCommit(),
    inviteCode: `${code.slice(0, 3)} · ${code.slice(3)}`,
    onShare: () => void onShare(),
    shareNote,
    onDone: () => router.replace("/home"),
    error,
  };
}
