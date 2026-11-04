import type { Metadata } from "next";
import { connection } from "next/server";
import { listMyTogethers } from "@/lib/actions/together";
import { must, requireTogether } from "../_lib/load";
import { TogethersView } from "./view";

export const metadata: Metadata = { title: "Your Togethers" };

export default async function TogethersPage() {
  await connection();
  await requireTogether();
  const togethers = must(await listMyTogethers(), "your Togethers");
  return <TogethersView togethers={togethers} />;
}
