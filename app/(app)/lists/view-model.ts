"use client";

import { useState } from "react";
import type { ChoreDraft } from "@/components/lists/add-chore-sheet";
import type { ListsTab } from "@/components/lists/lists-screen";
import type { ShoppingRowData } from "@/components/lists/shopping-panel";
import { addShoppingItem, clearDoneShoppingItems, setShoppingItemDone } from "@/lib/actions/lists";
import { addDays, dueLabel } from "@/lib/format";
import { choreSections, filterChores, type ChoreFilter } from "@/lib/lists/chores";
import { suggestItems } from "@/lib/lists/suggest";
import type { CatalogEntry, Chore, DayKey, ShoppingItem, Together } from "@/lib/models";
import { toChoreRow } from "../_lib/chore-rows";
import { TEMP, type Optimistic } from "../_lib/optimistic";
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
  const [items, setItems] = useState<Optimistic<ShoppingItem>[]>(initial);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

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
    onClearBasket: () => void onClearBasket(),
    error,
  };
}

const EMPTY_DRAFT = (meId: string): ChoreDraft => ({ title: "", due: null, repeat: "once", assignees: [meId] });

export function useListsViewModel(data: ListsViewData) {
  const { together, today } = data;
  const [tab, setTab] = useState<ListsTab>(data.tab);
  const shopping = useShopping(data.shopping, data.catalog, together);
  const { chores, error: choresError, toggle, add } = useChores(data.chores);
  const [filter, setFilter] = useState<ChoreFilter>("all");
  const [sheetOpen, setSheetOpen] = useState(false);
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
    setSheetError(null);
    setSheetOpen(false);
    setDraft(EMPTY_DRAFT(together.meId));
    const okay = await add({ title, due: submitted.due, repeat: submitted.repeat, assignees: submitted.assignees });
    if (!okay) {
      setDraft(submitted);
      setSheetError("Couldn't add that chore. Try again.");
      setSheetOpen(true);
    }
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
      onAddPress: () => setSheetOpen(true),
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
    },
  };
}
