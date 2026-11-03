import type { Metadata } from "next";
import { connection } from "next/server";
import { getPlaces } from "@/lib/actions/places";
import { must, requireTogether } from "../_lib/load";
import { PlacesView } from "./view";

export const metadata: Metadata = { title: "Places" };

export default async function PlacesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await connection();
  const [{ tab }] = await Promise.all([searchParams, requireTogether()]);
  const places = must(await getPlaces(), "your places");
  return <PlacesView data={{ tab: tab === "want" ? "want" : "been", places }} />;
}
