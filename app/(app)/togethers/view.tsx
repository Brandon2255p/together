"use client";

import { TogethersScreen } from "@/components/together/togethers-screen";
import type { TogetherSummary } from "@/lib/models";
import { useTogethersViewModel } from "./view-model";

export function TogethersView({ togethers }: { togethers: TogetherSummary[] }) {
  const vm = useTogethersViewModel(togethers);
  return <TogethersScreen {...vm} />;
}
