"use client";

import { AnimatePresence, motion } from "motion/react";
import { ScreenHeader } from "@/components/ui/layout";
import { Segmented } from "@/components/ui/segmented";

export type ListsTab = "shopping" | "chores";

const TABS: { value: ListsTab; label: string }[] = [
  { value: "shopping", label: "Shopping" },
  { value: "chores", label: "Chores" },
];

/** The Lists page: the Shopping / Chores switch over whichever panel is open */
export function ListsScreen({
  tab,
  onTabChange,
  shopping,
  chores,
}: {
  tab: ListsTab;
  onTabChange: (tab: ListsTab) => void;
  shopping: React.ReactNode;
  chores: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5">
      <ScreenHeader title="Lists" />
      <Segmented label="List" options={TABS} value={tab} onValueChange={onTabChange} />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={{ opacity: 0, x: tab === "chores" ? 16 : -16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: tab === "chores" ? -16 : 16 }}
          transition={{ duration: 0.18 }}
        >
          {tab === "shopping" ? shopping : chores}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
