import type { Metadata } from "next";
import { connection } from "next/server";
import { storageUsage } from "@/lib/actions/files";
import { requireTogether } from "../_lib/load";
import { TogetherView } from "./view";

export const metadata: Metadata = { title: "Your Together" };

export default async function TogetherPage() {
  await connection();
  const together = await requireTogether();
  // the storage card is extra: the screen still opens when it can't load
  const usage = await storageUsage();
  return <TogetherView together={together} usage={usage.data ?? null} />;
}
