"use server";

import { serverBackend } from "@/lib/backend/server";
import type { NewChore } from "@/lib/models";

export async function getShoppingItems() {
  return serverBackend.getShoppingItems();
}

export async function getItemCatalog() {
  return serverBackend.getItemCatalog();
}

export async function addShoppingItem(name: string, quantity = 1) {
  const trimmed = name.trim();
  if (!trimmed) return { data: null, error: "Type an item first." };
  return serverBackend.addShoppingItem({ name: trimmed.slice(0, 80), quantity: Math.max(1, Math.round(quantity)) });
}

export async function setShoppingItemDone(id: string, done: boolean) {
  return serverBackend.setShoppingItemDone({ id, done });
}

export async function clearDoneShoppingItems() {
  return serverBackend.clearDoneShoppingItems();
}

export async function getChores() {
  return serverBackend.getChores();
}

export async function addChore(chore: NewChore) {
  const title = chore.title.trim();
  if (!title) return { data: null, error: "What needs doing?" };
  if (!chore.assignees.length) return { data: null, error: "Assign it to at least one person." };
  return serverBackend.addChore({ ...chore, title: title.slice(0, 120) });
}

export async function setChoreDone(id: string, done: boolean) {
  return serverBackend.setChoreDone({ id, done });
}

export async function updateShoppingItem(id: string, name: string, quantity: number) {
  const trimmed = name.trim();
  if (!trimmed) return { data: null, error: "Give the item a name." };
  return serverBackend.updateShoppingItem({ id, name: trimmed.slice(0, 80), quantity: Math.min(99, Math.max(1, Math.round(quantity))) });
}

export async function deleteShoppingItem(id: string) {
  return serverBackend.deleteShoppingItem({ id });
}

export async function updateChore(id: string, chore: NewChore) {
  const title = chore.title.trim();
  if (!title) return { data: null, error: "Give the chore a name." };
  if (!chore.assignees.length) return { data: null, error: "Assign it to at least one person." };
  return serverBackend.updateChore({ id, ...chore, title: title.slice(0, 120) });
}

export async function deleteChore(id: string) {
  return serverBackend.deleteChore({ id });
}
