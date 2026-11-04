"use client";

import { useState } from "react";
import type { AddChoreSheetProps, ChoreDraft } from "@/components/lists/add-chore-sheet";
import { addDays, dueLabel } from "@/lib/format";
import type { DayKey, Together } from "@/lib/models";
import { TEMP } from "./optimistic";
import type { useChores } from "./use-chores";

const EMPTY_DRAFT = (meId: string): ChoreDraft => ({ title: "", due: null, repeat: "once", assignees: [meId] });

/**
 * View-model hook for the chore sheet, shared by Lists, Calendar and Home: adding a chore, or opening one to edit or
 * delete it. Saving is optimistic: the sheet closes at once, and opens again with the draft if saving fails.
 */
export function useChoreSheet(together: Together, today: DayKey, store: ReturnType<typeof useChores>) {
  const { chores, add, update, remove } = store;
  const [open, setOpen] = useState(false);
  // the chore open in the sheet; null when adding a new one
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ChoreDraft>(() => EMPTY_DRAFT(together.meId));
  const [error, setError] = useState<string | null>(null);

  // weekend: the next Saturday
  const saturday = addDays(today, (6 - new Date(`${today}T00:00:00Z`).getUTCDay() + 7) % 7 || 7);
  const dueOptions = [
    { value: null, label: "No date" },
    { value: today, label: "Today" },
    { value: addDays(today, 1), label: "Tomorrow" },
    { value: saturday, label: "Weekend" },
  ];

  async function onSubmit() {
    const title = draft.title.trim();
    if (!title) return setError("Give the chore a name.");
    if (draft.assignees.length === 0) return setError("Pick who it's for.");
    const submitted = draft;
    const id = editingId;
    setError(null);
    setOpen(false);
    const chore = { title, due: submitted.due, repeat: submitted.repeat, assignees: submitted.assignees };
    const okay = id ? await update(id, chore) : await add(chore);
    if (okay) {
      if (!id) setDraft(EMPTY_DRAFT(together.meId));
      return;
    }
    setEditingId(id);
    setDraft(submitted);
    setError(id ? "Couldn't save that chore. Try again." : "Couldn't add that chore. Try again.");
    setOpen(true);
  }

  function openAdd() {
    // coming from an edit: start a fresh draft
    if (editingId) setDraft(EMPTY_DRAFT(together.meId));
    setEditingId(null);
    setError(null);
    setOpen(true);
  }

  function openEdit(id: string) {
    const chore = chores.find((c) => c.id === id);
    // still saving: there's nothing on the server to change yet
    if (!chore || id.startsWith(TEMP)) return;
    setEditingId(id);
    setDraft({ title: chore.title, due: chore.due, repeat: chore.repeat, assignees: chore.assignees });
    setError(null);
    setOpen(true);
  }

  async function onDelete() {
    if (!editingId) return;
    const id = editingId;
    setOpen(false);
    setEditingId(null);
    setDraft(EMPTY_DRAFT(together.meId));
    await remove(id);
  }

  const sheet: AddChoreSheetProps = {
    open,
    onOpenChange: setOpen,
    draft,
    onDraftChange: (patch) => setDraft((d) => ({ ...d, ...patch })),
    dueOptions,
    customDueLabel: draft.due ? dueLabel(draft.due, today) : null,
    members: together.members,
    onSubmit: () => void onSubmit(),
    pending: false,
    error,
    mode: editingId ? "edit" : "add",
    onDelete: () => void onDelete(),
  };

  return { sheet, openAdd, openEdit };
}
