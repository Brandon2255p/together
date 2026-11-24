"use client";

import { TogetherScreen } from "@/components/together/together-screen";
import type { StorageUsage, Together } from "@/lib/models";
import { useTogetherViewModel } from "./view-model";

export function TogetherView({ together, usage }: { together: Together; usage: StorageUsage | null }) {
  const vm = useTogetherViewModel(together, usage);
  return <TogetherScreen {...vm} />;
}
