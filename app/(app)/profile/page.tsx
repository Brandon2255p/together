import type { Metadata } from "next";
import { connection } from "next/server";
import { requireTogether } from "../_lib/load";
import { ProfileView } from "./view";

export const metadata: Metadata = { title: "You" };

export default async function ProfilePage() {
  await connection();
  const together = await requireTogether();
  // read at request time, so the Docker image doesn't need rebuilding to turn reminders on
  return <ProfileView together={together} vapidPublicKey={process.env.VAPID_PUBLIC_KEY || null} />;
}
