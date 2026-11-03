"use server";

import { serverBackend } from "@/lib/backend/server";

export async function getWishes(ownerId: string) {
  return serverBackend.getWishes({ ownerId });
}

export async function getGoals() {
  return serverBackend.getGoals();
}

export async function setWishClaimed(id: string, claimed: boolean) {
  return serverBackend.setWishClaimed({ id, claimed });
}
