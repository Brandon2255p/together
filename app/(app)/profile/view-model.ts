"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { setMyName } from "@/lib/actions/profile";
import { turnOffReminders, turnOnReminders } from "@/lib/actions/reminders";
import { browserBackend } from "@/lib/backend/browser";
import type { Member, Together } from "@/lib/models";
import {
  canPromptInstall,
  currentPushSubscription,
  isInstalled,
  isIos,
  onInstallPromptChange,
  promptInstall,
  pushSupport,
  subscribeToPush,
} from "../_lib/pwa";

export type RemindersStatus = "loading" | "on" | "off" | "unsupported" | "needs-install" | "denied" | "no-keys";
export type InstallOption = "prompt" | "ios" | null;

export function useProfileViewModel(together: Together, vapidPublicKey: string | null) {
  const router = useRouter();
  const found = together.members.find((m) => m.id === together.meId);
  const [saved, setSaved] = useState(found?.name ?? "");
  const [name, setName] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [reminders, setReminders] = useState<RemindersStatus>("loading");
  const [remindersPending, setRemindersPending] = useState(false);
  const [install, setInstall] = useState<InstallOption>(null);

  // what this device can do: only known in the browser, after the first render
  useEffect(() => {
    let current = true;
    void (async () => {
      const support = pushSupport(vapidPublicKey);
      const status = support === "ready" ? ((await currentPushSubscription()) ? "on" : "off") : support;
      if (current) setReminders(status);
    })();
    const updateInstall = () => setInstall(isInstalled() ? null : canPromptInstall() ? "prompt" : isIos() ? "ios" : null);
    void Promise.resolve().then(updateInstall);
    const stop = onInstallPromptChange(updateInstall);
    return () => {
      current = false;
      stop();
    };
  }, [vapidPublicKey]);

  async function onRemindersToggle() {
    if (remindersPending) return;
    setRemindersPending(true);
    setError(null);
    try {
      if (reminders === "on") {
        const subscription = await currentPushSubscription();
        if (subscription) {
          await turnOffReminders(subscription.endpoint);
          await subscription.unsubscribe();
        }
        setReminders("off");
        return;
      }
      const keys = vapidPublicKey ? await subscribeToPush(vapidPublicKey) : null;
      if (!keys) {
        setReminders(pushSupport(vapidPublicKey) === "denied" ? "denied" : "off");
        return;
      }
      const result = await turnOnReminders(keys);
      if (!result.success) {
        setError(result.error ?? "We couldn't turn reminders on. Try again.");
        return;
      }
      setReminders("on");
    } catch (e) {
      console.warn("[pwa] reminders", e);
      setError("This browser couldn't set up reminders.");
    } finally {
      setRemindersPending(false);
    }
  }

  const clean = name.trim().replace(/\s+/g, " ");
  const me: Member = {
    id: together.meId,
    tone: found?.tone ?? "accent",
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
    // reminders on this device were for you: stop them before someone else signs in here
    const subscription = await currentPushSubscription().catch(() => null);
    if (subscription) {
      await turnOffReminders(subscription.endpoint);
      await subscription.unsubscribe().catch(() => false);
    }
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
    reminders,
    remindersPending,
    onRemindersToggle: () => void onRemindersToggle(),
    install,
    onInstall: () => void promptInstall(),
    backHref: "/home" as const,
    error,
  };
}
