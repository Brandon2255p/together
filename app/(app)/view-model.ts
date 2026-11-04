"use client";

import { usePathname } from "next/navigation";
import type { AppTab } from "@/components/layout/app-shell";

const TABS: AppTab[] = ["home", "lists", "calendar", "places", "wishlist"];

/** full-screen forms that hide the tab bar: /places/new, /places/new/manual, /places/[id]/edit */
const FORMS = [/^\/places\/new(\/|$)/, /^\/places\/[^/]+\/edit$/];

/** which tab the URL is under (routing stays out of the components) */
export function useAppShellViewModel() {
  const pathname = usePathname();
  const segment = pathname.split("/")[1] ?? "";
  const active = (TABS as string[]).includes(segment) ? (segment as AppTab) : null;
  return { active, tabBar: !FORMS.some((form) => form.test(pathname)) };
}
