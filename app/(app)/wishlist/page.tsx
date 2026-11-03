import type { Metadata } from "next";
import { connection } from "next/server";
import { getGoals, getWishes } from "@/lib/actions/wishlist";
import { must, requireTogether } from "../_lib/load";
import { WishlistView } from "./view";

export const metadata: Metadata = { title: "Wishlist" };

export default async function WishlistPage() {
  await connection();
  const together = await requireTogether();
  const partner = together.members.find((m) => m.id !== together.meId) ?? null;
  const [mine, goals, partners] = await Promise.all([
    getWishes(together.meId),
    getGoals(),
    partner ? getWishes(partner.id) : Promise.resolve({ data: [] }),
  ]);
  return (
    <WishlistView
      data={{
        together,
        mine: must(mine, "your wishlist"),
        goals: must(goals, "your goals"),
        partners: must(partners, "their wishlist"),
      }}
    />
  );
}
