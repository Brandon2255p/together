import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getPlaceWithGoogle } from "@/lib/actions/places";
import { requireTogether } from "../../_lib/load";
import { PlaceDetailView } from "./view";

export const metadata: Metadata = { title: "Place" };

export default async function PlaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const [{ id }, together] = await Promise.all([params, requireTogether()]);
  const { data } = await getPlaceWithGoogle(id);
  if (!data) notFound();
  return <PlaceDetailView data={{ ...data, together }} />;
}
