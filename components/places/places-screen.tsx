"use client";

import Link from "next/link";
import type { Route } from "next";
import { AnimatePresence } from "motion/react";
import { ArrowDownIcon, MapPinIcon, PlusIcon, Settings2Icon, XIcon } from "lucide-react";
import type { Hue, PlaceStatus } from "@/lib/models";
import { Chip, chipVariants } from "@/components/ui/chip";
import { IconButton, iconButtonVariants } from "@/components/ui/icon-button";
import { EmptyState, InlineError, ScreenHeader } from "@/components/ui/layout";
import { ListItem } from "@/components/ui/motion";
import { Segmented } from "@/components/ui/segmented";
import { Rating, Thumb } from "@/components/ui/thumb";
import { cn } from "@/lib/utils";

export interface PlaceCardData {
  id: string;
  name: string;
  /** "Japanese · 21 Beach Rd, Sea Point" */
  subtitle: string;
  hue: Hue;
  rating: number | null;
  badge: string | null;
  href: Route;
}

export interface PlaceGroupData {
  /** "Cape Town · Western Cape · South Africa" */
  label: string;
  places: PlaceCardData[];
}

export interface PlacesScreenProps {
  tab: PlaceStatus;
  onTabChange: (tab: PlaceStatus) => void;
  counts: Record<PlaceStatus, number>;
  addHref: Route;
  /** the chosen area, shown as a chip that clears it */
  filterChip: string | null;
  onClearFilter: () => void;
  sortLabel: string;
  onOpenFilters: () => void;
  groups: PlaceGroupData[];
  /** there are places on this tab, just none in the chosen area */
  filteredOut: boolean;
  error: string | null;
}

export function PlacesScreen(props: PlacesScreenProps) {
  const { tab, onTabChange, counts, addHref, filterChip, onClearFilter, sortLabel, onOpenFilters, groups, filteredOut, error } =
    props;
  return (
    <div className="flex flex-col gap-5">
      <ScreenHeader
        title="Places"
        actions={
          <Link href={addHref} aria-label="Add a place" className={iconButtonVariants({ variant: "surface" })}>
            <PlusIcon />
          </Link>
        }
      />
      <Segmented
        label="Places"
        value={tab}
        onValueChange={onTabChange}
        options={[
          { value: "been", label: `Been · ${counts.been}` },
          { value: "want", label: `Want to go · ${counts.want}` },
        ]}
      />

      <div className="-mx-5 flex items-center gap-2 overflow-x-auto px-5 [scrollbar-width:none]">
        <IconButton label="Filter and sort" size="sm" onClick={onOpenFilters}>
          <Settings2Icon />
        </IconButton>
        {filterChip ? (
          <button type="button" onClick={onClearFilter} aria-label={`Clear filter: ${filterChip}`} className={chipVariants({ tone: "accent" })}>
            {filterChip}
            <XIcon aria-hidden />
          </button>
        ) : null}
        <button type="button" onClick={onOpenFilters} className={chipVariants({ tone: "neutral" })}>
          {sortLabel}
          <ArrowDownIcon aria-hidden />
        </button>
      </div>

      <InlineError>{error}</InlineError>

      {groups.length === 0 ? (
        <EmptyState
          icon={<MapPinIcon aria-hidden />}
          title={filteredOut ? `Nothing in ${filterChip ?? "that area"} yet` : tab === "want" ? "Nowhere on the list yet" : "No places yet"}
          body={filteredOut ? "Clear the filter to see everything." : "Tap + to find one on Google Maps."}
        />
      ) : null}

      <ul className="flex flex-col gap-5">
        <AnimatePresence initial={false} mode="popLayout">
          {groups.map((group) => (
            <ListItem key={group.label}>
              <section className="flex flex-col gap-2.5" aria-label={group.label}>
                <h2 className="text-overline text-ink-subtle">{group.label}</h2>
                <ul className="flex flex-col gap-2.5">
                  {group.places.map((p) => (
                    <li key={p.id}>
                      <PlaceCard place={p} />
                    </li>
                  ))}
                </ul>
              </section>
            </ListItem>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}

function PlaceCard({ place: p }: { place: PlaceCardData }) {
  return (
    <Link
      href={p.href}
      className={cn("flex items-center gap-3.5 rounded-3xl bg-surface p-3 pr-4 transition-transform active:scale-[0.99]")}
    >
      <Thumb hue={p.hue} icon={<MapPinIcon />} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-body-strong">{p.name}</span>
        <span className="truncate text-caption font-normal text-ink-muted">{p.subtitle}</span>
        {p.rating !== null || p.badge ? (
          <span className="flex items-center gap-2">
            {p.rating !== null ? <Rating value={p.rating} /> : null}
            {p.badge ? <Chip>{p.badge}</Chip> : null}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
