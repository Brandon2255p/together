import type { Metadata } from "next";
import { connection } from "next/server";
import { getEvents } from "@/lib/actions/calendar";
import { getChores } from "@/lib/actions/lists";
import { gridRange } from "@/lib/calendar/month";
import { dayDate, todayKey } from "@/lib/format";
import { must, requireTogether } from "../_lib/load";
import { CalendarView } from "./view";

export const metadata: Metadata = { title: "Calendar" };

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** ?day=2026-11-14 opens on that day (a place's plan links here) */
export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  await connection();
  const [together, { day }] = await Promise.all([requireTogether(), searchParams]);
  const today = todayKey();
  const selected = day && DAY.test(day) && !Number.isNaN(Date.parse(day)) ? day : today;
  const d = dayDate(selected);
  const { from, to } = gridRange(d.getUTCFullYear(), d.getUTCMonth());
  const [events, chores] = await Promise.all([getEvents(from, to), getChores()]);
  return <CalendarView data={{ together, today, selected, events: must(events, "the calendar"), chores: must(chores, "your chores") }} />;
}
