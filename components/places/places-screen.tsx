"use client";

import Link from "next/link";
import type { Route } from "next";
import { AnimatePresence } from "motion/react";
import { ArrowRightIcon, LinkIcon, MapPinIcon } from "lucide-react";
import type { Hue, PlaceStatus } from "@/lib/models";
import { Chip } from "@/components/ui/chip";
import { IconButton } from "@/components/ui/icon-button";
import { EmptyState, InlineError, ScreenHeader } from "@/components/ui/layout";
import { ListItem } from "@/components/ui/motion";
import { Segmented } from "@/components/ui/segmented";
import { TextField } from "@/components/ui/text-field";
import { Skeleton } from "@/components/ui/skeleton";
import { Rating, Thumb } from "@/components/ui/thumb";
import { cn } from "@/lib/utils";

export interface PlaceCardData {
  id: string;
  name: string;
  subtitle: string;
  hue: Hue;
  rating: number | null;
  badge: string | null;
  href: Route;
  /** stays the same when an optimistic row is swapped for the saved one, so it doesn't animate out and back in */
  key?: string;
  /** still saving: no detail page to open yet, the subtitle shimmers */
  pending?: boolean;
}

export interface PlacesScreenProps {
  tab: PlaceStatus;
  onTabChange: (tab: PlaceStatus) => void;
  counts: Record<PlaceStatus, number>;
  input: string;
  onInputChange: (input: string) => void;
  onAdd: () => void;
  adding: boolean;
  places: PlaceCardData[];
  error: string | null;
}

export function PlacesScreen(props: PlacesScreenProps) {
  const { tab, onTabChange, counts, input, onInputChange, onAdd, adding, places, error } = props;
  return (
    <div className="flex flex-col gap-5">
      <ScreenHeader title="Places" />
      <Segmented
        label="Places"
        value={tab}
        onValueChange={onTabChange}
        options={[
          { value: "been", label: `Been · ${counts.been}` },
          { value: "want", label: `Want to go · ${counts.want}` },
        ]}
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onAdd();
        }}
      >
        <TextField
          label="Add a place"
          placeholder="Paste a Google Maps link or a name…"
          icon={<LinkIcon aria-hidden />}
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          enterKeyHint="go"
          trailing={
            input.trim() ? (
              <IconButton type="submit" label="Add place" variant="ink" size="sm" disabled={adding} className="shadow-none">
                <ArrowRightIcon />
              </IconButton>
            ) : null
          }
        />
      </form>
      <InlineError>{error}</InlineError>

      {places.length === 0 ? (
        <EmptyState
          icon={<MapPinIcon aria-hidden />}
          title={tab === "want" ? "Nowhere on the list yet" : "No places yet"}
          body="Paste a Google Maps link above to save one."
        />
      ) : null}

      <ul className="flex flex-col gap-2.5">
        <AnimatePresence initial={false} mode="popLayout">
          {places.map((p) => (
            <ListItem key={p.key ?? p.id}>
              <Link
                href={p.href}
                aria-disabled={p.pending}
                onClick={p.pending ? (e) => e.preventDefault() : undefined}
                className={cn(
                  "flex items-center gap-3.5 rounded-3xl bg-surface p-3 pr-4 transition-transform active:scale-[0.99]",
                  p.pending && "pointer-events-none",
                )}
              >
                <Thumb hue={p.hue} icon={<MapPinIcon />} />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className={cn("truncate text-body-strong", p.pending && "text-ink-muted")}>{p.name}</span>
                  {p.pending ? (
                    <Skeleton className="h-3 w-2/5 rounded-full" />
                  ) : (
                    <span className="truncate text-caption font-normal text-ink-muted">{p.subtitle}</span>
                  )}
                  {p.rating !== null || p.badge ? (
                    <span className="flex items-center gap-2">
                      {p.rating !== null ? <Rating value={p.rating} /> : null}
                      {p.badge ? <Chip>{p.badge}</Chip> : null}
                    </span>
                  ) : null}
                </span>
              </Link>
            </ListItem>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
