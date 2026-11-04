import type { Metadata } from "next";
import { connection } from "next/server";
import { requireTogether } from "../_lib/load";
import { TogetherView } from "./view";

export const metadata: Metadata = { title: "Your Together" };

export default async function TogetherPage() {
  await connection();
  const together = await requireTogether();
  return <TogetherView together={together} />;
}
