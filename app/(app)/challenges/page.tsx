import type { Metadata } from "next";
import { connection } from "next/server";
import { getChallenges } from "@/lib/actions/challenges";
import { todayKey } from "@/lib/format";
import { must, requireTogether } from "../_lib/load";
import { ChallengesView } from "./view";

export const metadata: Metadata = { title: "Challenges" };

export default async function ChallengesPage() {
  await connection();
  const [together, challenges] = await Promise.all([requireTogether(), getChallenges()]);
  return <ChallengesView data={{ together, today: todayKey(), challenges: must(challenges, "your challenges") }} />;
}
