"use client";

import { useState } from "react";
import { addChore, setChoreDone } from "@/lib/actions/lists";
import type { Chore, NewChore } from "@/lib/models";
import { TEMP, type Optimistic } from "./optimistic";
import { useServerState } from "./server-state";

/**
 * View-model hook shared by Home, Lists and Calendar: the chores and the IO that changes them.
 * Ticking and adding are optimistic; the server's answer (a recurring chore moves to its next date, a new chore gets
 * its real id) replaces it, and a failure puts it back and reports the error.
 */
export function useChores(initial: Chore[]) {
  const [chores, setChores] = useServerState<Optimistic<Chore>[]>(initial);
  const [error, setError] = useState<string | null>(null);

  async function toggle(id: string, done: boolean) {
    // still saving: there's nothing on the server to tick yet
    if (id.startsWith(TEMP)) return;
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
    setTimeout(() => setChores((cs) => cs.map((c) => (c.id === id ? { ...saved, clientKey: c.clientKey } : c))), saved.done === done ? 0 : 700);
  }

  async function add(chore: NewChore): Promise<boolean> {
    setError(null);
    const tempId = `${TEMP}${Date.now()}`;
    setChores((cs) => [{ ...chore, id: tempId, done: false }, ...cs]);
    const result = await addChore(chore);
    if (!result.data) {
      setChores((cs) => cs.filter((c) => c.id !== tempId));
      setError(result.error ?? "Couldn't add that chore.");
      return false;
    }
    const added = result.data;
    setChores((cs) => cs.map((c) => (c.id === tempId ? { ...added, clientKey: tempId } : c)));
    return true;
  }

  return { chores, error, setError, toggle, add };
}
