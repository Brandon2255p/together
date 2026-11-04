"use client";

import { useState } from "react";
import type { GoalDraft, WishDraft } from "@/components/wishlist/wish-sheets";
import type { GoalCardData, WishCardData, WishlistTab } from "@/components/wishlist/wishlist-screen";
import { addGoal, addWish, deleteWish, setGoalSaved, setWishClaimed } from "@/lib/actions/wishlist";
import { rands } from "@/lib/format";
import type { Goal, Member, Together, WishItem } from "@/lib/models";
import { TEMP, type Optimistic } from "../_lib/optimistic";

export interface WishlistViewData {
  together: Together;
  mine: WishItem[];
  goals: Goal[];
  partners: WishItem[];
}

const EMPTY_WISH: WishDraft = { name: "", price: "", url: "" };
const EMPTY_GOAL: GoalDraft = { title: "", target: "", shared: false };

/** "R1 200", "1,200" → 1200; "" → null; nonsense → NaN */
function readRands(text: string): number | null {
  const cleaned = text.replace(/[\s,]/g, "");
  return cleaned ? Number(cleaned) : null;
}

export function useWishlistViewModel(data: WishlistViewData) {
  const { together } = data;
  const [tab, setTab] = useState<WishlistTab>("mine");
  const [mine, setMine] = useState<Optimistic<WishItem>[]>(data.mine);
  const [goals, setGoals] = useState<Optimistic<Goal>[]>(data.goals);
  const [partners, setPartners] = useState(data.partners);
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const partner = together.members.find((m) => m.id !== together.meId);

  // sheets
  const [wishOpen, setWishOpen] = useState(false);
  const [wishDraft, setWishDraft] = useState<WishDraft>(EMPTY_WISH);
  const [wishError, setWishError] = useState<string | null>(null);
  const [openWishId, setOpenWishId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalDraft, setGoalDraft] = useState<GoalDraft>(EMPTY_GOAL);
  const [goalError, setGoalError] = useState<string | null>(null);
  const [savingsGoalId, setSavingsGoalId] = useState<string | null>(null);
  const [savingsAmount, setSavingsAmount] = useState("");
  const [savingsError, setSavingsError] = useState<string | null>(null);

  const goalCards: GoalCardData[] = goals.map((g) => ({
    id: g.clientKey ?? g.id,
    title: g.title,
    people: g.ownerIds.map((id) => together.members.find((m) => m.id === id)).filter((m): m is Member => !!m),
    shared: g.ownerIds.length > 1,
    saved: rands(g.saved),
    target: rands(g.target),
    progress: g.target ? Math.min(1, g.saved / g.target) : 0,
  }));

  const card = (w: Optimistic<WishItem>, own: boolean): WishCardData => ({
    id: own ? (w.clientKey ?? w.id) : w.id,
    name: w.name,
    price: w.price === null ? null : rands(w.price),
    hue: w.hue,
    claimedByMe: own ? null : w.claimedBy === together.meId,
    url: w.url,
  });

  /** cards use the temporary id as their key; this finds the wish behind one */
  const findMine = (key: string) => mine.find((w) => (w.clientKey ?? w.id) === key);
  const findGoal = (key: string) => goals.find((g) => (g.clientKey ?? g.id) === key);

  /** optimistic: flips straight away, puts it back if the server says no (someone else got there first) */
  async function onClaimChange(id: string, claimed: boolean) {
    if (pendingIds.includes(id)) return;
    const before = partners.find((w) => w.id === id)?.claimedBy ?? null;
    const setClaimedBy = (claimedBy: string | null) =>
      setPartners((ws) => ws.map((w) => (w.id === id ? { ...w, claimedBy } : w)));
    setPendingIds((p) => [...p, id]);
    setError(null);
    setClaimedBy(claimed ? together.meId : null);
    const result = await setWishClaimed(id, claimed);
    setPendingIds((p) => p.filter((x) => x !== id));
    if (!result.success) {
      setClaimedBy(before);
      setError(result.error ?? "Couldn't save that.");
    }
  }

  async function onAddWish() {
    const name = wishDraft.name.trim();
    if (!name) return setWishError("What would you love?");
    const price = readRands(wishDraft.price);
    if (price !== null && Number.isNaN(price)) return setWishError("That price doesn't look right.");
    let url = wishDraft.url.trim() || null;
    if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
    if (url && !URL.canParse(url)) return setWishError("That link doesn't look right.");
    const wish = { name, price, url };
    const tempId = `${TEMP}${Date.now()}`;
    const hues = ["accent", "partner", "success", "warning"] as const;
    setMine((ws) => [...ws, { ...wish, id: tempId, ownerId: together.meId, claimedBy: null, hue: hues[ws.length % hues.length] ?? "accent" }]);
    setTab("mine");
    setWishOpen(false);
    setWishDraft(EMPTY_WISH);
    setWishError(null);
    const result = await addWish(wish);
    if (!result.data) {
      setMine((ws) => ws.filter((w) => w.id !== tempId));
      setError(result.error ?? "Couldn't add that wish.");
      return;
    }
    const saved = result.data;
    setMine((ws) => ws.map((w) => (w.id === tempId ? { ...saved, clientKey: tempId } : w)));
  }

  async function onDeleteWish(key: string) {
    const wish = findMine(key);
    if (!wish || wish.id.startsWith(TEMP)) return;
    setDeleting(true);
    setDeleteError(null);
    const result = await deleteWish(wish.id);
    setDeleting(false);
    if (!result.success) return setDeleteError(result.error ?? "Couldn't remove that.");
    setOpenWishId(null);
    setMine((ws) => ws.filter((w) => w.id !== wish.id));
  }

  async function onAddGoal() {
    const title = goalDraft.title.trim();
    if (!title) return setGoalError("What are you saving for?");
    const target = readRands(goalDraft.target);
    if (target === null || Number.isNaN(target) || target < 1) return setGoalError("Set how much you need.");
    const goal = {
      title,
      target,
      ownerIds: goalDraft.shared ? together.members.map((m) => m.id) : [together.meId],
    };
    const tempId = `${TEMP}${Date.now()}`;
    setGoals((gs) => [...gs, { ...goal, id: tempId, saved: 0 }]);
    setGoalOpen(false);
    setGoalDraft(EMPTY_GOAL);
    setGoalError(null);
    const result = await addGoal(goal);
    if (!result.data) {
      setGoals((gs) => gs.filter((g) => g.id !== tempId));
      setError(result.error ?? "Couldn't start that goal.");
      return;
    }
    const saved = result.data;
    setGoals((gs) => gs.map((g) => (g.id === tempId ? { ...saved, clientKey: tempId } : g)));
  }

  async function onAddSavings() {
    const goal = savingsGoalId ? findGoal(savingsGoalId) : undefined;
    if (!goal) return;
    if (goal.id.startsWith(TEMP)) return setSavingsError("Still saving that goal. Try again in a moment.");
    const amount = readRands(savingsAmount);
    if (amount === null || Number.isNaN(amount) || amount <= 0) return setSavingsError("How much are you adding?");
    const before = goal.saved;
    const next = Math.round(before + amount);
    const update = (saved: number) => setGoals((gs) => gs.map((g) => (g.id === goal.id ? { ...g, saved } : g)));
    update(next);
    setSavingsGoalId(null);
    setSavingsAmount("");
    setSavingsError(null);
    const result = await setGoalSaved(goal.id, next);
    if (!result.data) {
      update(before);
      setError(result.error ?? "Couldn't save that.");
    }
  }

  const openWish = openWishId ? findMine(openWishId) : undefined;
  const savingsGoal = savingsGoalId ? findGoal(savingsGoalId) : undefined;

  return {
    tab,
    onTabChange: setTab,
    partnerName: partner?.name ?? "them",
    goals: goalCards,
    mine: mine.map((w) => card(w, true)),
    partners: partners.map((w) => card(w, false)),
    onClaimChange: (id: string, claimed: boolean) => void onClaimChange(id, claimed),
    pendingIds,
    loading: false,
    error,

    onAddWishPress: () => {
      setWishError(null);
      setWishOpen(true);
    },
    addWish: {
      open: wishOpen,
      onOpenChange: setWishOpen,
      draft: wishDraft,
      onDraftChange: (patch: Partial<WishDraft>) => setWishDraft((d) => ({ ...d, ...patch })),
      onSubmit: () => void onAddWish(),
      error: wishError,
    },
    onWishOpen: (key: string) => {
      setDeleteError(null);
      setOpenWishId(key);
    },
    wishSheet: {
      wish: openWish
        ? { id: openWish.clientKey ?? openWish.id, name: openWish.name, price: openWish.price === null ? null : rands(openWish.price), url: openWish.url }
        : null,
      onClose: () => setOpenWishId(null),
      onDelete: (key: string) => void onDeleteWish(key),
      pending: deleting,
      error: deleteError,
    },

    onAddGoalPress: () => {
      setGoalError(null);
      setGoalOpen(true);
    },
    addGoal: {
      open: goalOpen,
      onOpenChange: setGoalOpen,
      draft: goalDraft,
      onDraftChange: (patch: Partial<GoalDraft>) => setGoalDraft((d) => ({ ...d, ...patch })),
      onSubmit: () => void onAddGoal(),
      error: goalError,
      canShare: together.members.length > 1,
    },
    onAddSavingsPress: (key: string) => {
      setSavingsError(null);
      setSavingsAmount("");
      setSavingsGoalId(key);
    },
    savings: {
      goal: savingsGoal
        ? { id: savingsGoalId ?? savingsGoal.id, title: savingsGoal.title, progress: `${rands(savingsGoal.saved)} of ${rands(savingsGoal.target)}` }
        : null,
      amount: savingsAmount,
      onAmountChange: setSavingsAmount,
      onClose: () => setSavingsGoalId(null),
      onSubmit: () => void onAddSavings(),
      error: savingsError,
    },
  };
}
