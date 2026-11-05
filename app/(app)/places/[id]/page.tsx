import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getPlacePlans, getPlaceWithGoogle } from "@/lib/actions/places";
import { requireTogether } from "../../_lib/load";
import { PlaceDetailView } from "./view";

export const metadata: Metadata = { title: "Place" };

export default async function PlaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const [{ id }, together] = await Promise.all([params, requireTogether()]);
  const [{ data }, plans] = await Promise.all([getPlaceWithGoogle(id), getPlacePlans(id)]);
  if (!data) notFound();
  // the place still shows if its plans don't load; they come back on the next load
  return <PlaceDetailView data={{ ...data, together, plans: plans.data ?? [] }} />;
}
