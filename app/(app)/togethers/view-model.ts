"use client";

import { useEffect, useMemo, useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { createTogether, joinTogether, switchTogether } from "@/lib/actions/together";
import type { TogetherSummary } from "@/lib/models";
import { clusterExtent, layoutBubbles } from "@/lib/together/bubbles";

export function useTogethersViewModel(togethers: TogetherSummary[]) {
  const router = useRouter();
  // the layout's clock: fixed when the screen opens, so bubbles don't resize while you look
  const [now] = useState(() => Date.now());
  const bubbles = useMemo(() => layoutBubbles(togethers, now), [togethers, now]);
  const [opening, setOpening] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"join" | "create" | null>(null);
  const [code, setCode] = useState("");
  const [newName, setNewName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Home is where every pick lands: load it ahead so the switch doesn't wait on it
  useEffect(() => {
    router.prefetch("/home");
  }, [router]);

  function goHome() {
    router.push("/home");
    router.refresh();
  }

  async function pick(id: string) {
    if (opening) return;
    // answer the tap straight away (the screen shows the opening overlay), then switch and go
    setOpening(id);
    setError(null);
    if (togethers.find((t) => t.id === id)?.current) return goHome();
    const result = await switchTogether(id);
    if (!result.success) {
      setOpening(null);
      setError(result.error ?? "We couldn't open that Together. Try again.");
      // the camera flew in; reload the page to bring it back out
      router.refresh();
      return;
    }
    goHome();
  }

  async function join() {
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await joinTogether(code);
    if (!result.data) {
      setPending(false);
      return setError(result.error ?? "We couldn't join that Together. Try again.");
    }
    goHome();
  }

  async function create() {
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await createTogether(newName);
    if (!result.data) {
      setPending(false);
      return setError(result.error ?? "We couldn't make it. Try again.");
    }
    router.push("/together");
    router.refresh();
  }

  return {
    back: "/home" as Route,
    bubbles,
    extent: clusterExtent(bubbles),
    opening,
    onPick: (id: string) => void pick(id),
    sheet,
    onSheetChange: (next: "join" | "create" | null) => {
      setError(null);
      setSheet(next);
    },
    code,
    onCodeChange: (value: string) => {
      setCode(value);
      setError(null);
    },
    onJoin: () => void join(),
    newName,
    onNewNameChange: (value: string) => {
      setNewName(value);
      setError(null);
    },
    onCreate: () => void create(),
    pending,
    error,
  };
}
