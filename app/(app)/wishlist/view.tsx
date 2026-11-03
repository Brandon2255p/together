"use client";

import { WishlistScreen } from "@/components/wishlist/wishlist-screen";
import { useWishlistViewModel, type WishlistViewData } from "./view-model";

export function WishlistView({ data }: { data: WishlistViewData }) {
  const vm = useWishlistViewModel(data);
  return <WishlistScreen {...vm} />;
}
