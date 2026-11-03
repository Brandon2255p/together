"use client";

import { TogetherScreen } from "@/components/onboarding/together-screen";
import { useTogetherOnboardingViewModel } from "./view-model";

export function TogetherOnboardingView() {
  const vm = useTogetherOnboardingViewModel();
  return (
    <div className="mx-auto max-w-[440px]">
      <TogetherScreen {...vm} />
    </div>
  );
}
