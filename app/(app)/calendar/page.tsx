import type { Metadata } from "next";
import { connection } from "next/server";
import { getEvents } from "@/lib/actions/calendar";
import { getChores } from "@/lib/actions/lists";
import { gridRange } from "@/lib/calendar/month";
import { dayDate, todayKey } from "@/lib/format";
import { must, requireTogether } from "../_lib/load";
import { CalendarView } from "./view";

export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage() {
  await connection();
  const together = await requireTogether();
  const today = todayKey();
  const d = dayDate(today);
  const { from, to } = gridRange(d.getUTCFullYear(), d.getUTCMonth());
  const [events, chores] = await Promise.all([getEvents(from, to), getChores()]);
  return <CalendarView data={{ together, today, events: must(events, "the calendar"), chores: must(chores, "your chores") }} />;
}
