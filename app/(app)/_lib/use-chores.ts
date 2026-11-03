"use client";

import { useState } from "react";
import { addChore, setChoreDone } from "@/lib/actions/lists";
import type { Chore, NewChore } from "@/lib/models";

/**
 * View-model hook shared by Home, Lists and Calendar: the chores and the IO that changes them.
 * Ticking is optimistic; the server's answer (a recurring chore moves to its next date) replaces it, and a failure
 * puts it back and reports the error.
 */
export function useChores(initial: Chore[]) {
  const [chores, setChores] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  async function toggle(id: string, done: boolean) {
    const before = chores;
    setError(null);
    setChores((cs) => cs.map((c) => (c.id === id ? { ...c, done } : c)));
    const result = await setChoreDone(id, done);
    if (!result.data) {
      setChores(before);
      setError(result.error ?? "Couldn't save that. Try again.");
      return;
    }
    const saved = result.data;
    // let the tick animation play before a recurring chore jumps to its next date
    setTimeout(() => setChores((cs) => cs.map((c) => (c.id === id ? saved : c))), saved.done === done ? 0 : 700);
  }

  async function add(chore: NewChore): Promise<boolean> {
    setError(null);
    const result = await addChore(chore);
    if (!result.data) {
      setError(result.error ?? "Couldn't add that chore.");
      return false;
    }
    const added = result.data;
    setChores((cs) => [added, ...cs]);
    return true;
  }

  return { chores, error, setError, toggle, add };
}
