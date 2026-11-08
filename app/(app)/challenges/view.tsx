"use client";

import { ChallengesScreen } from "@/components/challenges/challenges-screen";
import { useChallengesViewModel, type ChallengesViewData } from "./view-model";

export function ChallengesView({ data }: { data: ChallengesViewData }) {
  const vm = useChallengesViewModel(data);
  return <ChallengesScreen {...vm} />;
}
