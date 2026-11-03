"use server";

import { serverBackend } from "@/lib/backend/server";

// Server actions: the only bridge from view-models (client) to serverBackend.

export async function getTogether() {
  return serverBackend.getTogether();
}

export async function createTogether(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return { data: null, error: "Give your Together a name." };
  return serverBackend.createTogether({ name: trimmed.slice(0, 60) });
}

export async function renameTogether(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return { success: false, error: "Give your Together a name." };
  return serverBackend.renameTogether({ name: trimmed.slice(0, 60) });
}

export async function joinTogether(code: string) {
  if (code.replace(/[^a-z0-9]/gi, "").length < 6) return { data: null, error: "Invite codes are 6 letters and numbers." };
  return serverBackend.joinTogether({ code });
}
