"use client";

import { useState } from "react";
import type { ChoreDraft } from "@/components/lists/add-chore-sheet";
import type { ListsTab } from "@/components/lists/lists-screen";
import type { ItemDraft } from "@/components/lists/item-sheet";
import type { ShoppingRowData } from "@/components/lists/shopping-panel";
import {
  addShoppingItem,
  clearDoneShoppingItems,
  deleteShoppingItem,
  setShoppingItemDone,
  updateShoppingItem,
} from "@/lib/actions/lists";
import { addDays, dueLabel } from "@/lib/format";
import { choreSections, filterChores, type ChoreFilter } from "@/lib/lists/chores";
import { suggestItems } from "@/lib/lists/suggest";
import type { CatalogEntry, Chore, DayKey, ShoppingItem, Together } from "@/lib/models";
import { toChoreRow } from "../_lib/chore-rows";
import { TEMP, type Optimistic } from "../_lib/optimistic";
import { useServerState } from "../_lib/server-state";
import { useChores } from "../_lib/use-chores";

export interface ListsViewData {
  tab: ListsTab;
  together: Together;
  today: DayKey;
  shopping: ShoppingItem[];
  catalog: CatalogEntry[];
  chores: Chore[];
}

function useShopping(initial: ShoppingItem[], catalog: CatalogEntry[], together: Together) {
  const [items, setItems] = useServerState<Optimistic<ShoppingItem>[]>(initial);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  // the item open in the edit sheet
  const [editing, setEditing] = useState<{ id: string; draft: ItemDraft } | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);

  const label = (i: ShoppingItem) => (i.quantity > 1 ? `${i.name}  ×${i.quantity}` : i.name);
  const row = (i: Optimistic<ShoppingItem>): ShoppingRowData => ({
    id: i.id,
    key: i.clientKey ?? i.id,
    label: label(i),
    done: i.done,
    addedBy: together.members.find((m) => m.id === i.addedBy) ?? null,
  });

  async function onAdd(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setQuery("");
    setError(null);
    // optimistic: show it straight away under a temporary id
    const tempId = `${TEMP}${Date.now()}`;
    setItems((is) => [{ id: tempId, name: trimmed, quantity: 1, addedBy: together.meId, done: false }, ...is]);
    const result = await addShoppingItem(trimmed);
    if (!result.data) {
      setItems((is) => is.filter((i) => i.id !== tempId));
      setError(result.error ?? "Couldn't add that.");
      return;
    }
    const saved = result.data;
    setItems((is) => is.map((i) => (i.id === tempId ? { ...saved, clientKey: tempId } : i)));
  }

  async function onDoneChange(id: string, done: boolean) {
    const before = items;
    setError(null);
    setItems((is) => is.map((i) => (i.id === id ? { ...i, done } : i)));
    const result = await setShoppingItemDone(id, done);
    if (!result.success) {
      setItems(before);
      setError(result.error ?? "Couldn't save that.");
    }
  }

  function onOpen(id: string) {
    const item = items.find((i) => i.id === id);
    // still saving: there's nothing on the server to change yet
    if (!item || id.startsWith(TEMP)) return;
    setSheetError(null);
    setEditing({ id, draft: { name: item.name, quantity: item.quantity } });
  }

  async function onSave() {
    if (!editing) return;
    const name = editing.draft.name.trim();
    if (!name) return setSheetError("Give the item a name.");
    const { id, draft } = editing;
    const before = items;
    // optimistic: close and show the change straight away; if saving fails, reopen with the draft
    setEditing(null);
    setError(null);
    setItems((is) => is.map((i) => (i.id === id ? { ...i, name, quantity: draft.quantity } : i)));
    const result = await updateShoppingItem(id, name, draft.quantity);
    if (!result.data) {
      setItems(before);
      setSheetError(result.error ?? "Couldn't save that.");
      setEditing({ id, draft });
      return;
    }
    const saved = result.data;
    setItems((is) => is.map((i) => (i.id === id ? { ...saved, clientKey: i.clientKey } : i)));
  }

  async function onDelete() {
    if (!editing) return;
    const { id } = editing;
    const before = items;
    setEditing(null);
    setError(null);
    setItems((is) => is.filter((i) => i.id !== id));
    const result = await deleteShoppingItem(id);
    if (!result.success) {
      setItems(before);
      setError(result.error ?? "Couldn't remove that.");
    }
  }

  async function onClearBasket() {
    const before = items;
    setItems((is) => is.filter((i) => !i.done));
    const result = await clearDoneShoppingItems();
    if (!result.success) {
      setItems(before);
      setError(result.error ?? "Couldn't clear the basket.");
    }
  }

  return {
    query,
    onQueryChange: setQuery,
    suggestions: suggestItems(query, catalog, items.filter((i) => !i.done).map((i) => i.name)),
    onAdd: (name: string) => void onAdd(name),
    toBuy: items.filter((i) => !i.done).map(row),
    inBasket: items.filter((i) => i.done).map(row),
    onDoneChange: (id: string, done: boolean) => void onDoneChange(id, done),
    onOpen,
    onClearBasket: () => void onClearBasket(),
    error,
    sheet: {
      draft: editing?.draft ?? null,
      onDraftChange: (patch: Partial<ItemDraft>) => setEditing((e) => (e ? { ...e, draft: { ...e.draft, ...patch } } : e)),
      onClose: () => setEditing(null),
      onSave: () => void onSave(),
      onDelete: () => void onDelete(),
      error: sheetError,
    },
  };
}

const EMPTY_DRAFT = (meId: string): ChoreDraft => ({ title: "", due: null, repeat: "once", assignees: [meId] });

export function useListsViewModel(data: ListsViewData) {
  const { together, today } = data;
  const [tab, setTab] = useState<ListsTab>(data.tab);
  const shopping = useShopping(data.shopping, data.catalog, together);
  const { chores, error: choresError, toggle, add, update, remove } = useChores(data.chores);
  const [filter, setFilter] = useState<ChoreFilter>("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  // the chore open in the sheet; null when adding a new one
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ChoreDraft>(() => EMPTY_DRAFT(together.meId));
  const [sheetError, setSheetError] = useState<string | null>(null);

  const partner = together.members.find((m) => m.id !== together.meId);
  const filters: { value: ChoreFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "mine", label: "Mine" },
    ...(partner ? [{ value: "partner" as const, label: partner.name }, { value: "shared" as const, label: "Shared" }] : []),
  ];

  const sections = choreSections(filterChores(chores, filter, together.meId), today).map((s) => ({
    key: s.key,
    title: s.title,
    rows: s.chores.map((c) => toChoreRow(c, together.members, today)),
  }));

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
    if (!title) return setSheetError("Give the chore a name.");
    if (draft.assignees.length === 0) return setSheetError("Pick who it's for.");
    // optimistic: close the sheet and show the chore straight away; if saving fails, reopen it with the draft
    const submitted = draft;
    const id = editingId;
    setSheetError(null);
    setSheetOpen(false);
    const chore = { title, due: submitted.due, repeat: submitted.repeat, assignees: submitted.assignees };
    const okay = id ? await update(id, chore) : await add(chore);
    if (!okay) {
      setEditingId(id);
      setDraft(submitted);
      setSheetError(id ? "Couldn't save that chore. Try again." : "Couldn't add that chore. Try again.");
      setSheetOpen(true);
    }
  }

  function openAdd() {
    // coming from an edit: start a fresh draft
    if (editingId) setDraft(EMPTY_DRAFT(together.meId));
    setEditingId(null);
    setSheetError(null);
    setSheetOpen(true);
  }

  function openEdit(id: string) {
    const chore = chores.find((c) => c.id === id);
    if (!chore || id.startsWith(TEMP)) return;
    setEditingId(id);
    setDraft({ title: chore.title, due: chore.due, repeat: chore.repeat, assignees: chore.assignees });
    setSheetError(null);
    setSheetOpen(true);
  }

  async function onDelete() {
    if (!editingId) return;
    const id = editingId;
    setSheetOpen(false);
    setEditingId(null);
    setDraft(EMPTY_DRAFT(together.meId));
    await remove(id);
  }

  return {
    tab,
    onTabChange: (t: ListsTab) => {
      setTab(t);
      // keep the tab in the URL without asking the server for the page again
      window.history.replaceState(null, "", t === "chores" ? "/lists?tab=chores" : "/lists");
    },
    shopping,
    chores: {
      filters,
      filter,
      onFilterChange: setFilter,
      sections,
      onDoneChange: (id: string, done: boolean) => void toggle(id, done),
      onOpen: openEdit,
      onAddPress: openAdd,
      error: choresError,
    },
    addChore: {
      open: sheetOpen,
      onOpenChange: setSheetOpen,
      draft,
      onDraftChange: (patch: Partial<ChoreDraft>) => setDraft((d) => ({ ...d, ...patch })),
      dueOptions,
      customDueLabel: draft.due ? dueLabel(draft.due, today) : null,
      members: together.members,
      onSubmit: () => void onSubmit(),
      pending: false,
      error: sheetError,
      mode: editingId ? ("edit" as const) : ("add" as const),
      onDelete: () => void onDelete(),
    },
  };
}
