"use client";

import type { ComingSoonScreenProps } from "@/components/files/coming-soon-screen";

/** placeholder until the Gallery screens are built (docs/plans/shared-files.md) */
export function useGalleryViewModel(): ComingSoonScreenProps {
  return { back: "/home", title: "Gallery", kind: "gallery", body: "Photos and videos you share, ordered by when they were taken." };
}
