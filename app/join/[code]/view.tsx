"use client";

import { JoinScreen } from "@/components/together/join-screen";
import type { InvitePreview } from "@/lib/models";
import { useJoinViewModel } from "./view-model";

export function JoinView(props: { code: string; invite: InvitePreview | null; hasTogether: boolean }) {
  const vm = useJoinViewModel(props);
  return <JoinScreen {...vm} />;
}
