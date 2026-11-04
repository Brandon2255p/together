"use client";

import Link from "next/link";
import type { Route } from "next";
import { AnimatePresence } from "motion/react";
import { ClockIcon, MapPinIcon, PartyPopperIcon, ShoppingBagIcon, UserRoundIcon } from "lucide-react";
import type { Member, MemberTone } from "@/lib/models";
import { SwitcherPill } from "@/components/together/switcher-pill";
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
  upNext: { title: string; when: string; where: string | null; people: Member[] } | null;
  dueToday: ChoreRowData[];
  onChoreDoneChange: (id: string, done: boolean) => void;
  toBuy: number;
  wantToGo: number;
  links: { chores: Route; shopping: Route; places: Route; calendar: Route; together: Route; togethers: Route; profile: Route };
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
  const { greeting, dateLabel, members, switcher, upNext, dueToday, onChoreDoneChange, toBuy, wantToGo, links, error } = props;
  return (
    <Reveal className="flex flex-col gap-5">
      <RevealItem className="flex flex-col gap-3">
        <SwitcherPill {...switcher} href={links.togethers} className="self-start" />
        <ScreenHeader
          eyebrow={dateLabel}
          title={greeting}
          actions={
            <>
              <Link href={links.together} aria-label={`Who's in ${switcher.name}`} className="rounded-full transition-transform active:scale-95">
                <AvatarStack members={members.slice(0, 4)} size="lg" />
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
                  <ChoreRow row={row} onDoneChange={onChoreDoneChange} />
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
    </Reveal>
  );
}
