"use client";

import { CalendarIcon, GiftIcon, HouseIcon, ListChecksIcon, MapPinIcon } from "lucide-react";
import { TabBar, type TabBarItem } from "@/components/ui/tab-bar";

export type AppTab = "home" | "lists" | "calendar" | "places" | "wishlist";

const TABS: TabBarItem<AppTab>[] = [
  { key: "home", label: "Home", href: "/home", icon: <HouseIcon aria-hidden /> },
  { key: "lists", label: "Lists", href: "/lists", icon: <ListChecksIcon aria-hidden /> },
  { key: "calendar", label: "Calendar", href: "/calendar", icon: <CalendarIcon aria-hidden /> },
  { key: "places", label: "Places", href: "/places", icon: <MapPinIcon aria-hidden /> },
  { key: "wishlist", label: "Wishlist", href: "/wishlist", icon: <GiftIcon aria-hidden /> },
];

/**
 * The phone-width column with the floating tab bar. Mobile first: wider screens just centre the column.
 * `tabBar` false leaves it off, for full-screen forms (Add place, Edit place).
 */
export function AppShell({ active, tabBar = true, children }: { active: AppTab | null; tabBar?: boolean; children: React.ReactNode }) {
  if (!tabBar) {
    return (
      <div className="mx-auto min-h-dvh max-w-[440px] px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {children}
      </div>
    );
  }
  return (
    <div className="mx-auto min-h-dvh max-w-[440px]">
      <div className="px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-36">{children}</div>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[440px]">
        <div className="h-24 bg-linear-to-b from-bg/0 to-bg" />
        <div className="pointer-events-auto bg-bg px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <TabBar items={TABS} active={active} />
        </div>
      </div>
    </div>
  );
}
