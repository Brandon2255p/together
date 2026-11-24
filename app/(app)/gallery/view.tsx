"use client";

import { GalleryScreen } from "@/components/files/gallery-screen";
import type { Gallery, Together } from "@/lib/models";
import { useGalleryViewModel } from "./view-model";

export function GalleryView({ together, gallery }: { together: Together; gallery: Gallery }) {
  const vm = useGalleryViewModel(gallery, together);
  return <GalleryScreen {...vm} />;
}
