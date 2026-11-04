"use server";

import { serverBackend } from "@/lib/backend/server";
import type { DayKey, NewEvent } from "@/lib/models";

export async function getEvents(from: DayKey, to: DayKey) {
  return serverBackend.getEvents({ from, to });
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function addEvent(event: NewEvent) {
  const title = event.title.trim();
  if (!title) return { data: null, error: "Give it a name." };
  if (!DAY.test(event.day)) return { data: null, error: "Pick a day." };
  if (event.time !== null && !TIME.test(event.time)) return { data: null, error: "That time doesn't look right." };
  const location = event.location?.trim() || null;
  return serverBackend.addEvent({
    title: title.slice(0, 120),
    day: event.day,
    time: event.time,
    location: location?.slice(0, 120) ?? null,
    attendees: [...new Set(event.attendees)],
  });
}

export async function deleteEvent(id: string) {
  return serverBackend.deleteEvent({ id });
}
