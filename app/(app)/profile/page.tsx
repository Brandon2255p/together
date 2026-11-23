import type { Metadata } from "next";
import { connection } from "next/server";
import { requireTogether } from "../_lib/load";
import { ProfileView } from "./view";

export const metadata: Metadata = { title: "You" };

export default async function ProfilePage() {
  await connection();
  const together = await requireTogether();
  // read at request time, so turning reminders on only needs the env vars, not a rebuild
  return <ProfileView together={together} vapidPublicKey={process.env.VAPID_PUBLIC_KEY || null} />;
}
