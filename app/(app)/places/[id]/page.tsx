import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getPlace } from "@/lib/actions/places";
import { requireTogether } from "../../_lib/load";
import { PlaceDetailView } from "./view";

export const metadata: Metadata = { title: "Place" };

export default async function PlaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const [{ id }, together] = await Promise.all([params, requireTogether()]);
  const { data: place } = await getPlace(id);
  if (!place) notFound();
  return <PlaceDetailView data={{ place, together }} />;
}
