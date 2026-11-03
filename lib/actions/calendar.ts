"use server";

import { serverBackend } from "@/lib/backend/server";
import type { DayKey } from "@/lib/models";

export async function getEvents(from: DayKey, to: DayKey) {
  return serverBackend.getEvents({ from, to });
}
