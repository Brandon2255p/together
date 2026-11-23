"use client";

import { ComingSoonScreen } from "@/components/files/coming-soon-screen";
import { useGalleryViewModel } from "./view-model";

export function GalleryView() {
  const vm = useGalleryViewModel();
  return <ComingSoonScreen {...vm} />;
}
