import type { Metadata } from "next";
import { connection } from "next/server";
import { getChores, getItemCatalog, getShoppingItems } from "@/lib/actions/lists";
import { todayKey } from "@/lib/format";
import { must, requireTogether } from "../_lib/load";
import { ListsView } from "./view";

export const metadata: Metadata = { title: "Lists" };

export default async function ListsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await connection();
  const [{ tab }, together] = await Promise.all([searchParams, requireTogether()]);
  const [shopping, catalog, chores] = await Promise.all([getShoppingItems(), getItemCatalog(), getChores()]);
  return (
    <ListsView
      data={{
        tab: tab === "chores" ? "chores" : "shopping",
        together,
        today: todayKey(),
        shopping: must(shopping, "the shopping list"),
        catalog: must(catalog, "item suggestions"),
        chores: must(chores, "your chores"),
      }}
    />
  );
}
