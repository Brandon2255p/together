"use server";

import { serverBackend } from "@/lib/backend/server";

/** 1 to 40 characters, as the profiles table allows */
export async function setMyName(name: string) {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed) return { success: false, error: "Your name can't be empty." };
  return serverBackend.setMyName({ name: trimmed.slice(0, 40) });
}
