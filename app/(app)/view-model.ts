"use client";

import { usePathname } from "next/navigation";
import type { AppTab } from "@/components/layout/app-shell";

const TABS: AppTab[] = ["home", "lists", "calendar", "places", "wishlist"];

/** which tab the URL is under (routing stays out of the components) */
export function useAppShellViewModel() {
  const segment = usePathname().split("/")[1] ?? "";
  const active = (TABS as string[]).includes(segment) ? (segment as AppTab) : null;
  return { active };
}
