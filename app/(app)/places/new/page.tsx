import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getPlace, getPlaces, previewGooglePlace } from "@/lib/actions/places";
import { usualArea } from "@/lib/places/address";
import { must, requireTogether } from "../../_lib/load";
import { AddPlaceView } from "./view";

export const metadata: Metadata = { title: "Add a place" };

type Search = { place?: string; replace?: string; tab?: string };

export default async function AddPlacePage({ searchParams }: { searchParams: Promise<Search> }) {
  await connection();
  const [{ place, replace, tab }] = await Promise.all([searchParams, requireTogether()]);
  const [places, initial, replacing] = await Promise.all([
    getPlaces(),
    place ? previewGooglePlace(place, null) : null,
    replace ? getPlace(replace) : null,
  ]);
  if (replace && !replacing?.data) notFound();
  return (
    <AddPlaceView
      data={{
        near: usualArea(must(places, "your places")),
        initial: initial?.data ?? null,
        replacing: replacing?.data ? { id: replacing.data.id, name: replacing.data.name } : null,
        status: tab === "been" ? "been" : "want",
      }}
    />
  );
}
