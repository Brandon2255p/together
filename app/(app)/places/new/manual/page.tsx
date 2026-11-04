import type { Metadata } from "next";
import { connection } from "next/server";
import { requireTogether } from "../../../_lib/load";
import { ManualPlaceView } from "./view";

export const metadata: Metadata = { title: "Add a place by hand" };

export default async function ManualPlacePage({ searchParams }: { searchParams: Promise<{ name?: string; tab?: string }> }) {
  await connection();
  const [{ name, tab }] = await Promise.all([searchParams, requireTogether()]);
  return <ManualPlaceView data={{ name: (name ?? "").slice(0, 120), status: tab === "been" ? "been" : "want" }} />;
}
