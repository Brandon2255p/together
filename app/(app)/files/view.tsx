"use client";

import { ComingSoonScreen } from "@/components/files/coming-soon-screen";
import { useFilesViewModel } from "./view-model";

export function FilesView() {
  const vm = useFilesViewModel();
  return <ComingSoonScreen {...vm} />;
}
