"use server";

import { serverBackend } from "@/lib/backend/server";
import type { DayKey, NewEvent } from "@/lib/models";

export async function getEvents(from: DayKey, to: DayKey) {
  return serverBackend.getEvents({ from, to });
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** tidies a plan, or says what's wrong with it */
function clean(event: NewEvent): { event: NewEvent; error: null } | { event: null; error: string } {
  const title = event.title.trim();
  if (!title) return { event: null, error: "Give it a name." };
  if (!DAY.test(event.day)) return { event: null, error: "Pick a day." };
  if (event.time !== null && !TIME.test(event.time)) return { event: null, error: "That time doesn't look right." };
  const location = event.location?.trim() || null;
  return {
    event: {
      title: title.slice(0, 120),
      day: event.day,
      time: event.time,
      location: location?.slice(0, 120) ?? null,
      attendees: [...new Set(event.attendees)],
    },
    error: null,
  };
}

export async function addEvent(event: NewEvent) {
  const checked = clean(event);
  if (!checked.event) return { data: null, error: checked.error };
  return serverBackend.addEvent(checked.event);
}

export async function updateEvent(id: string, event: NewEvent) {
  const checked = clean(event);
  if (!checked.event) return { data: null, error: checked.error };
  return serverBackend.updateEvent({ id, ...checked.event });
}

export async function deleteEvent(id: string) {
  return serverBackend.deleteEvent({ id });
}
