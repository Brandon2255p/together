"use client";

import { AnimatePresence, motion } from "motion/react";
import { GiftIcon, SparklesIcon, TargetIcon } from "lucide-react";
import type { Hue, Member } from "@/lib/models";
import { AvatarStack } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState, InlineError, ScreenHeader, SectionHeader } from "@/components/ui/layout";
import { ListItem } from "@/components/ui/motion";
import { Progress } from "@/components/ui/progress";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/utils";

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
}

const SOFT: Record<Hue, string> = {
  accent: "bg-accent-soft text-accent",
  partner: "bg-partner-soft text-partner",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
};

export function WishlistScreen(props: WishlistScreenProps) {
  const { tab, onTabChange, partnerName, goals, mine, partners, onClaimChange, pendingIds, loading, error } = props;
  return (
    <div className="flex flex-col gap-5">
      <ScreenHeader title="Wishlist" />
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
              {goals.length ? (
                <section className="flex flex-col gap-3">
                  <SectionHeader title="Saving for" />
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
                    </div>
                  ))}
                </section>
              ) : null}

              <section className="flex flex-col gap-3">
                <SectionHeader title={`Wants · ${mine.length}`} />
                {mine.length === 0 ? (
                  <EmptyState icon={<GiftIcon aria-hidden />} title="Nothing on your list" body="Add things you'd love — it helps at birthdays." />
                ) : (
                  <ul className="grid grid-cols-2 gap-3">
                    {mine.map((w) => (
                      <ListItem key={w.id} className="flex flex-col gap-2.5 rounded-3xl bg-surface p-2.5 pb-3.5">
                        <span className={cn("grid h-24 place-items-center rounded-2xl", SOFT[w.hue])} aria-hidden>
                          <GiftIcon className="size-7" />
                        </span>
                        <span className="flex flex-col gap-0.5 px-1">
                          <span className="text-body-strong">{w.name}</span>
                          {w.price ? <span className="text-caption text-ink-muted">{w.price}</span> : null}
                        </span>
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
                        {w.price ? <span className="text-caption text-ink-muted">{w.price}</span> : null}
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
    </div>
  );
}
