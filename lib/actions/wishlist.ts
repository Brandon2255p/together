"use server";

import { serverBackend } from "@/lib/backend/server";
import type { NewGoal, NewWish } from "@/lib/models";

export async function getWishes(ownerId: string) {
  return serverBackend.getWishes({ ownerId });
}

export async function getGoals() {
  return serverBackend.getGoals();
}

export async function setWishClaimed(id: string, claimed: boolean) {
  return serverBackend.setWishClaimed({ id, claimed });
}

/** a price typed by hand: "R1 200", "1200", "1,200.50" → whole rands; null when empty */
function wholeRands(price: number | null): number | null | "bad" {
  if (price === null) return null;
  if (!Number.isFinite(price) || price < 0 || price > 10_000_000) return "bad";
  return Math.round(price);
}

export async function addWish(wish: NewWish) {
  const name = wish.name.trim();
  if (!name) return { data: null, error: "What would you love?" };
  const price = wholeRands(wish.price);
  if (price === "bad") return { data: null, error: "That price doesn't look right." };
  let url = wish.url?.trim() || null;
  if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
  if (url && !URL.canParse(url)) return { data: null, error: "That link doesn't look right." };
  return serverBackend.addWish({ name: name.slice(0, 120), price, url });
}

export async function deleteWish(id: string) {
  return serverBackend.deleteWish({ id });
}

export async function addGoal(goal: NewGoal) {
  const title = goal.title.trim();
  if (!title) return { data: null, error: "What are you saving for?" };
  const target = wholeRands(goal.target);
  if (target === "bad" || target === null || target < 1) return { data: null, error: "Set how much you need." };
  if (!goal.ownerIds.length) return { data: null, error: "Choose whose goal it is." };
  return serverBackend.addGoal({ title: title.slice(0, 120), target, ownerIds: [...new Set(goal.ownerIds)] });
}

export async function setGoalSaved(id: string, saved: number) {
  const amount = wholeRands(saved);
  if (amount === "bad" || amount === null) return { data: null, error: "That amount doesn't look right." };
  return serverBackend.setGoalSaved({ id, saved: amount });
}
