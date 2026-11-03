"use client";

import { useState } from "react";
import type { GoalCardData, WishCardData, WishlistTab } from "@/components/wishlist/wishlist-screen";
import { setWishClaimed } from "@/lib/actions/wishlist";
import { rands } from "@/lib/format";
import type { Goal, Member, Together, WishItem } from "@/lib/models";

export interface WishlistViewData {
  together: Together;
  mine: WishItem[];
  goals: Goal[];
  partners: WishItem[];
}

export function useWishlistViewModel(data: WishlistViewData) {
  const { together } = data;
  const [tab, setTab] = useState<WishlistTab>("mine");
  const [partners, setPartners] = useState(data.partners);
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const partner = together.members.find((m) => m.id !== together.meId);

  const goals: GoalCardData[] = data.goals.map((g) => ({
    id: g.id,
    title: g.title,
    people: g.ownerIds.map((id) => together.members.find((m) => m.id === id)).filter((m): m is Member => !!m),
    shared: g.ownerIds.length > 1,
    saved: rands(g.saved),
    target: rands(g.target),
    progress: g.target ? g.saved / g.target : 0,
  }));

  const card = (w: WishItem, own: boolean): WishCardData => ({
    id: w.id,
    name: w.name,
    price: w.price === null ? null : rands(w.price),
    hue: w.hue,
    claimedByMe: own ? null : w.claimedBy === together.meId,
  });

  async function onClaimChange(id: string, claimed: boolean) {
    setPendingIds((p) => [...p, id]);
    setError(null);
    const result = await setWishClaimed(id, claimed);
    setPendingIds((p) => p.filter((x) => x !== id));
    if (!result.success) return setError(result.error ?? "Couldn't save that.");
    setPartners((ws) => ws.map((w) => (w.id === id ? { ...w, claimedBy: claimed ? together.meId : null } : w)));
  }

  return {
    tab,
    onTabChange: setTab,
    partnerName: partner?.name ?? "them",
    goals,
    mine: data.mine.map((w) => card(w, true)),
    partners: partners.map((w) => card(w, false)),
    onClaimChange: (id: string, claimed: boolean) => void onClaimChange(id, claimed),
    pendingIds,
    loading: false,
    error,
  };
}
