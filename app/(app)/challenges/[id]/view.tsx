"use client";

import { ChallengeScreen } from "@/components/challenges/challenge-screen";
import { useChallengeViewModel, type ChallengeViewData } from "./view-model";

export function ChallengeView({ data }: { data: ChallengeViewData }) {
  const vm = useChallengeViewModel(data);
  return <ChallengeScreen {...vm} />;
}
