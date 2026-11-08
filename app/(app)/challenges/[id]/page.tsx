import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getChallenge } from "@/lib/actions/challenges";
import { todayKey } from "@/lib/format";
import { requireTogether } from "../../_lib/load";
import { ChallengeView } from "./view";

export const metadata: Metadata = { title: "Challenge" };

export default async function ChallengePage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const [{ id }, together] = await Promise.all([params, requireTogether()]);
  const { data } = await getChallenge(id);
  if (!data) notFound();
  return <ChallengeView data={{ together, today: todayKey(), challenge: data }} />;
}
