import type { Metadata } from "next";
import { connection } from "next/server";
import { requireTogether } from "../_lib/load";
import { ProfileView } from "./view";

export const metadata: Metadata = { title: "You" };

export default async function ProfilePage() {
  await connection();
  const together = await requireTogether();
  return <ProfileView together={together} />;
}
