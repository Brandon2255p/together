"use client";

import type { ComingSoonScreenProps } from "@/components/files/coming-soon-screen";

/** placeholder until the Files screens are built (docs/plans/shared-files.md) */
export function useFilesViewModel(): ComingSoonScreenProps {
  return { back: "/home", title: "Files", kind: "files", body: "Documents you share, like IDs, passports and car papers, in simple folders." };
}
