import type { Metadata } from "next";
import { connection } from "next/server";
import { getEvents } from "@/lib/actions/calendar";
import { getChores, getShoppingItems } from "@/lib/actions/lists";
import { getPlaces } from "@/lib/actions/places";
import { listMyTogethers } from "@/lib/actions/together";
import { addDays, todayKey } from "@/lib/format";
import { must, requireTogether } from "../_lib/load";
import { HomeView } from "./view";

export const metadata: Metadata = { title: "Home" };

export default async function HomePage() {
  await connection();
  const together = await requireTogether();
  const today = todayKey();
  const [chores, shopping, places, events, togethers] = await Promise.all([
    getChores(),
    getShoppingItems(),
    getPlaces(),
    getEvents(today, addDays(today, 14)),
    listMyTogethers(),
  ]);
  return (
    <HomeView
      data={{
        together,
        today,
        chores: must(chores, "your chores"),
        toBuy: must(shopping, "the shopping list").filter((i) => !i.done).length,
        wantToGo: must(places, "your places").filter((p) => p.status === "want").length,
        events: must(events, "the calendar"),
        // the pill still works without the list; it just shows no dot
        togethers: togethers.data ?? [],
      }}
    />
  );
}
