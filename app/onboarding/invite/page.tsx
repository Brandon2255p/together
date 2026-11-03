import type { Metadata } from "next";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getTogether } from "@/lib/actions/together";
import { InviteView } from "./view";

export const metadata: Metadata = { title: "Invite your person" };

export default async function InvitePage() {
  await connection();
  const { data: together } = await getTogether();
  if (!together) redirect("/onboarding/together");
  return <InviteView together={together} />;
}
