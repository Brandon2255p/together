"use client";

import Link from "next/link";
import type { Route } from "next";
import { AnimatePresence } from "motion/react";
import { ClockIcon, MapPinIcon, PartyPopperIcon, ShoppingBagIcon, UserRoundIcon } from "lucide-react";
import type { Member, MemberTone } from "@/lib/models";
import { Flame } from "@/components/challenges/art";
import { ManagePill } from "@/components/together/manage-pill";
import { SwitcherPill } from "@/components/together/switcher-pill";
import { AddChoreSheet, type AddChoreSheetProps } from "@/components/lists/add-chore-sheet";
import { ChoreRow, type ChoreRowData } from "@/components/lists/chore-row";
import { AvatarStack } from "@/components/ui/avatar";
import { iconButtonVariants } from "@/components/ui/icon-button";
import { IconBadge, InlineError, ScreenHeader, SectionHeader } from "@/components/ui/layout";
import { ListItem, Reveal, RevealItem } from "@/components/ui/motion";
import { Orb } from "@/components/ui/orb";

export interface HomeScreenProps {
  greeting: string;
  dateLabel: string;
  members: Member[];
  /** the switcher pill: the current Together, and whether another one has news */
  switcher: { name: string; tone: MemberTone; hasNews: boolean };
  /** the flame pill: the longest challenge streak going, and whether one needs a booster */
  streak: { count: number; atRisk: boolean };
  upNext: { title: string; when: string; where: string | null; people: Member[] } | null;
  dueToday: ChoreRowData[];
  onChoreDoneChange: (id: string, done: boolean) => void;
  /** opens a chore in the chore sheet to edit it */
  onChoreOpen: (id: string) => void;
  choreSheet: AddChoreSheetProps;
  toBuy: number;
  wantToGo: number;
  links: { chores: Route; shopping: Route; places: Route; calendar: Route; together: Route; togethers: Route; profile: Route; challenges: Route };
  error: string | null;
}

function Tile({ href, icon, tone, count, label }: { href: Route; icon: React.ReactNode; tone: "accent" | "partner"; count: number; label: string }) {
  return (
    <Link href={href} className="flex flex-1 flex-col gap-3.5 rounded-3xl bg-surface p-4 transition-transform active:scale-[0.98]">
      <IconBadge tone={tone}>{icon}</IconBadge>
      <span className="flex flex-col">
        <span className="text-display-l">{count}</span>
        <span className="text-caption text-ink-muted">{label}</span>
      </span>
    </Link>
  );
}

export function HomeScreen(props: HomeScreenProps) {
  const { greeting, dateLabel, members, switcher, streak, upNext, dueToday, onChoreDoneChange, onChoreOpen, choreSheet, toBuy, wantToGo, links, error } = props;
  return (
    <Reveal className="flex flex-col gap-5">
      <RevealItem className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <SwitcherPill {...switcher} href={links.togethers} className="min-w-0" />
          <ManagePill name={switcher.name} members={members} href={links.together} />
        </div>
        <ScreenHeader
          eyebrow={dateLabel}
          title={greeting}
          actions={
            <>
            <Link
              href={links.challenges}
              aria-label={`Challenges: ${streak.count} streak${streak.atRisk ? ", one needs a booster" : ""}`}
              className="relative flex h-9 items-center gap-1 rounded-full border border-line bg-surface pr-3 pl-2.5 text-body-strong transition-transform active:scale-[0.95]"
            >
              <Flame cold={streak.count === 0} flicker={streak.count > 0} className="h-5 w-4" />
              {streak.count}
              {streak.atRisk ? <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-partner ring-2 ring-bg" /> : null}
            </Link>
            <Link href={links.profile} aria-label="You: your name and signing out" className={iconButtonVariants({ variant: "surface", size: "sm" })}>
              <UserRoundIcon aria-hidden />
            </Link>
            </>
          }
        />
      </RevealItem>

      <RevealItem>
        <Link
          href={links.calendar}
          className="relative isolate flex flex-col gap-3.5 overflow-hidden rounded-card bg-ink p-5 text-on-accent transition-transform active:scale-[0.99]"
        >
          <Orb className="absolute -top-16 -right-14 -z-10 size-60 opacity-90" speed={0.7} />
          <span className="flex items-center justify-between">
            <span className="text-overline text-ink-subtle">Up next</span>
            {upNext ? <AvatarStack members={upNext.people} /> : null}
          </span>
          {upNext ? (
            <span className="flex flex-col gap-1">
              <span className="text-display-l">{upNext.title}</span>
              <span className="flex items-center gap-1.5 text-callout text-ink-subtle">
                <ClockIcon className="size-4" aria-hidden />
                {upNext.when}
                {upNext.where ? ` · ${upNext.where}` : ""}
              </span>
            </span>
          ) : (
            <span className="text-display-l">A free evening</span>
          )}
        </Link>
      </RevealItem>

      <RevealItem className="flex flex-col gap-3">
        <SectionHeader title="Due today" action={<Link href={links.chores}>See all</Link>} />
        <InlineError>{error}</InlineError>
        {dueToday.length ? (
          <ul className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {dueToday.map((row) => (
                <ListItem key={row.key ?? row.id}>
                  <ChoreRow row={row} onDoneChange={onChoreDoneChange} onOpen={onChoreOpen} />
                </ListItem>
              ))}
            </AnimatePresence>
          </ul>
        ) : (
          <p className="flex items-center gap-2 rounded-row bg-surface px-4 py-4 text-callout text-ink-muted">
            <PartyPopperIcon className="size-5 text-accent" aria-hidden />
            Nothing due today. Enjoy it.
          </p>
        )}
      </RevealItem>

      <RevealItem className="flex flex-col gap-3">
        <SectionHeader title="At a glance" />
        <div className="flex gap-3">
          <Tile href={links.shopping} icon={<ShoppingBagIcon aria-hidden />} tone="accent" count={toBuy} label="to buy" />
          <Tile href={links.places} icon={<MapPinIcon aria-hidden />} tone="partner" count={wantToGo} label="places to try" />
        </div>
      </RevealItem>
      <AddChoreSheet {...choreSheet} />
    </Reveal>
  );
}
