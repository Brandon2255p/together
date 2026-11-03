"use client";

import { AddChoreSheet } from "@/components/lists/add-chore-sheet";
import { ChoresPanel } from "@/components/lists/chores-panel";
import { ListsScreen } from "@/components/lists/lists-screen";
import { ShoppingPanel } from "@/components/lists/shopping-panel";
import { useListsViewModel, type ListsViewData } from "./view-model";

export function ListsView({ data }: { data: ListsViewData }) {
  const { tab, onTabChange, shopping, chores, addChore } = useListsViewModel(data);
  return (
    <>
      <ListsScreen
        tab={tab}
        onTabChange={onTabChange}
        shopping={<ShoppingPanel {...shopping} />}
        chores={<ChoresPanel {...chores} />}
      />
      <AddChoreSheet {...addChore} />
    </>
  );
}
