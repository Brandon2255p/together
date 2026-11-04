import type { Metadata } from "next";
import { connection } from "next/server";
import { getInvitePreview, getTogether } from "@/lib/actions/together";
import { JoinView } from "./view";

export const metadata: Metadata = { title: "Join a Together" };

// Signed-out visitors are sent to /sign-in by the proxy, and come back here afterwards.
export default async function JoinPage({ params }: PageProps<"/join/[code]">) {
  await connection();
  const { code } = await params;
  const [invite, together] = await Promise.all([getInvitePreview(code), getTogether()]);
  if (invite.error) throw new Error(`Couldn't check the invite: ${invite.error}`);
  return <JoinView code={code} invite={invite.data} hasTogether={!!together.data} />;
}
