"use client";

import { AnimatePresence, motion } from "motion/react";
import { ExternalLinkIcon, GiftIcon, PlusIcon, SparklesIcon, TargetIcon } from "lucide-react";
import type { Hue, Member } from "@/lib/models";
import { AvatarStack } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { IconButton } from "@/components/ui/icon-button";
import { EmptyState, InlineError, ScreenHeader, SectionHeader } from "@/components/ui/layout";
import { ListItem } from "@/components/ui/motion";
import { Progress } from "@/components/ui/progress";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/utils";
import {
  AddGoalSheet,
  AddWishSheet,
  SavingsSheet,
  WishSheet,
  type GoalDraft,
  type SavingsSheetData,
  type WishDraft,
  type WishSheetData,
} from "./wish-sheets";

export type WishlistTab = "mine" | "partner";

export interface GoalCardData {
  id: string;
  title: string;
  people: Member[];
  shared: boolean;
  saved: string;
  target: string;
  progress: number;
}

export interface WishCardData {
  id: string;
  name: string;
  price: string | null;
  hue: Hue;
  /** someone else's wish: claimed by me (true), free (false). Null on my own wishes. */
  claimedByMe: boolean | null;
  url: string | null;
}

export interface WishlistScreenProps {
  tab: WishlistTab;
  onTabChange: (tab: WishlistTab) => void;
  partnerName: string;
  goals: GoalCardData[];
  mine: WishCardData[];
  partners: WishCardData[];
  onClaimChange: (id: string, claimed: boolean) => void;
  pendingIds: string[];
  loading: boolean;
  error: string | null;
  onAddWishPress: () => void;
  addWish: { open: boolean; onOpenChange: (open: boolean) => void; draft: WishDraft; onDraftChange: (patch: Partial<WishDraft>) => void; onSubmit: () => void; error: string | null };
  onWishOpen: (id: string) => void;
  wishSheet: { wish: WishSheetData | null; onClose: () => void; onDelete: (id: string) => void; pending: boolean; error: string | null };
  onAddGoalPress: () => void;
  addGoal: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    draft: GoalDraft;
    onDraftChange: (patch: Partial<GoalDraft>) => void;
    onSubmit: () => void;
    error: string | null;
    canShare: boolean;
  };
  onAddSavingsPress: (goalId: string) => void;
  savings: { goal: SavingsSheetData | null; amount: string; onAmountChange: (amount: string) => void; onClose: () => void; onSubmit: () => void; error: string | null };
}

const SOFT: Record<Hue, string> = {
  accent: "bg-accent-soft text-accent",
  partner: "bg-partner-soft text-partner",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
};

export function WishlistScreen(props: WishlistScreenProps) {
  const { tab, onTabChange, partnerName, goals, mine, partners, onClaimChange, pendingIds, loading, error } = props;
  const { onAddWishPress, addWish, onWishOpen, wishSheet, onAddGoalPress, addGoal, onAddSavingsPress, savings } = props;
  return (
    <div className="flex flex-col gap-5">
      <ScreenHeader
        title="Wishlist"
        actions={
          <IconButton label="Add a wish" variant="ink" onClick={onAddWishPress}>
            <PlusIcon />
          </IconButton>
        }
      />
      <Segmented
        label="Whose wishlist"
        value={tab}
        onValueChange={onTabChange}
        options={[
          { value: "mine", label: "Mine" },
          { value: "partner", label: `For ${partnerName}` },
        ]}
      />
      <InlineError>{error}</InlineError>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className={cn("flex flex-col gap-5 transition-opacity", loading && "opacity-60")}
        >
          {tab === "mine" ? (
            <>
              <section className="flex flex-col gap-3">
                  <SectionHeader
                    title="Saving for"
                    action={
                      <button type="button" onClick={onAddGoalPress}>
                        New goal
                      </button>
                    }
                  />
                  {goals.length === 0 ? (
                    <button
                      type="button"
                      onClick={onAddGoalPress}
                      className="flex items-center gap-2 rounded-row border border-dashed border-line px-4 py-4 text-callout text-ink-muted"
                    >
                      <TargetIcon className="size-5 text-accent" aria-hidden />
                      Saving up for something? Start a goal.
                    </button>
                  ) : null}
                  {goals.map((g) => (
                    <div key={g.id} className="flex flex-col gap-3.5 rounded-card bg-surface p-5">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-caption text-accent-ink">
                          <TargetIcon className="size-[18px]" aria-hidden />
                          {g.shared ? "Together goal" : "My goal"}
                        </span>
                        <AvatarStack members={g.people} />
                      </div>
                      <p className="text-title">{g.title}</p>
                      <p className="flex items-baseline gap-1.5">
                        <span className="text-display-l">{g.saved}</span>
                        <span className="text-callout text-ink-muted">of {g.target}</span>
                      </p>
                      <Progress value={g.progress} label={`${g.title} progress`} />
                      <Button size="sm" variant="soft" className="self-start" onClick={() => onAddSavingsPress(g.id)}>
                        <PlusIcon className="size-3.5" aria-hidden />
                        Add savings
                      </Button>
                    </div>
                  ))}
              </section>

              <section className="flex flex-col gap-3">
                <SectionHeader title={`Wants · ${mine.length}`} />
                {mine.length === 0 ? (
                  <EmptyState icon={<GiftIcon aria-hidden />} title="Nothing on your list" body="Add things you'd love — it helps at birthdays." />
                ) : (
                  <ul className="grid grid-cols-2 gap-3">
                    {mine.map((w) => (
                      <ListItem key={w.id}>
                        <button
                          type="button"
                          onClick={() => onWishOpen(w.id)}
                          className="flex w-full flex-col gap-2.5 rounded-3xl bg-surface p-2.5 pb-3.5 text-left transition-transform active:scale-[0.98]"
                        >
                          <span className={cn("grid h-24 w-full place-items-center rounded-2xl", SOFT[w.hue])} aria-hidden>
                            <GiftIcon className="size-7" />
                          </span>
                          <span className="flex flex-col gap-0.5 px-1">
                            <span className="text-body-strong">{w.name}</span>
                            {w.price ? <span className="text-caption text-ink-muted">{w.price}</span> : null}
                          </span>
                        </button>
                      </ListItem>
                    ))}
                  </ul>
                )}
              </section>
            </>
          ) : (
            <>
              <p className="flex items-center gap-3 rounded-row bg-partner-soft px-4 py-3.5 text-caption text-ink">
                <SparklesIcon className="size-5 shrink-0 text-partner" aria-hidden />
                {partnerName} can&apos;t see what you&apos;ve claimed. Surprises stay surprises.
              </p>
              <section className="flex flex-col gap-3">
                <SectionHeader title={`${partnerName}'s wishes · ${partners.length}`} />
                <ul className="flex flex-col gap-2">
                  {partners.map((w) => (
                    <ListItem key={w.id} className="flex items-center gap-3.5 rounded-[22px] bg-surface p-3">
                      <span className={cn("grid size-[52px] shrink-0 place-items-center rounded-2xl", SOFT[w.hue])} aria-hidden>
                        <GiftIcon className="size-[22px]" />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-body-strong">{w.name}</span>
                        <span className="flex items-center gap-2 text-caption text-ink-muted">
                          {w.price}
                          {w.url ? (
                            <a href={w.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline-offset-2 hover:text-ink hover:underline">
                              <ExternalLinkIcon className="size-3.5" aria-hidden />
                              Where to buy
                            </a>
                          ) : null}
                        </span>
                      </span>
                      <AnimatePresence mode="wait" initial={false}>
                        {w.claimedByMe ? (
                          <motion.button
                            key="claimed"
                            type="button"
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            onClick={() => onClaimChange(w.id, false)}
                            disabled={pendingIds.includes(w.id)}
                            aria-label={`Unclaim ${w.name}`}
                          >
                            <Chip tone="success">Claimed by you</Chip>
                          </motion.button>
                        ) : (
                          <motion.span key="claim" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}>
                            <Button size="sm" pending={pendingIds.includes(w.id)} onClick={() => onClaimChange(w.id, true)}>
                              Claim
                            </Button>
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </ListItem>
                  ))}
                </ul>
              </section>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <AddWishSheet {...addWish} />
      <WishSheet {...wishSheet} />
      <AddGoalSheet {...addGoal} />
      <SavingsSheet {...savings} />
    </div>
  );
}
