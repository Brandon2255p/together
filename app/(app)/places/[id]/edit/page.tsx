import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getPlaceWithGoogle } from "@/lib/actions/places";
import { requireTogether } from "../../../_lib/load";
import { EditPlaceView } from "./view";

export const metadata: Metadata = { title: "Edit place" };

export default async function EditPlacePage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const [{ id }] = await Promise.all([params, requireTogether()]);
  const { data } = await getPlaceWithGoogle(id);
  if (!data) notFound();
  return <EditPlaceView data={data} />;
}
