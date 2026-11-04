"use client";

import { TogetherScreen } from "@/components/together/together-screen";
import type { Together } from "@/lib/models";
import { useTogetherViewModel } from "./view-model";

export function TogetherView({ together }: { together: Together }) {
  const vm = useTogetherViewModel(together);
  return <TogetherScreen {...vm} />;
}
