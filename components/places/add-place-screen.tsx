"use client";

import Link from "next/link";
import type { Route } from "next";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeftIcon, LinkIcon, LoaderCircleIcon, MapPinIcon, NavigationIcon, SearchIcon, StarIcon, XIcon } from "lucide-react";
import type { PlaceStatus } from "@/lib/models";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { IconButton, iconButtonVariants } from "@/components/ui/icon-button";
import { InlineError } from "@/components/ui/layout";
import { Photo } from "@/components/ui/photo";
import { Skeleton } from "@/components/ui/skeleton";
import { TextField } from "@/components/ui/text-field";
import { cn } from "@/lib/utils";
import { FieldLabel, FormHeader, KindPicker, StatusPicker } from "./fields";

export interface SuggestionRow {
  placeId: string;
  /** the name split into plain and matched parts, the matched ones highlighted */
  parts: { text: string; match: boolean }[];
  secondary: string;
  road: boolean;
}

export interface PlacePreview {
  name: string;
  address: string;
  photo: { url: string; credit: string | null; creditUrl: string | null } | null;
  /** "4.5" */
  rating: string | null;
  /** "R R R" */
  price: string | null;
  hours: { text: string; open: boolean } | null;
}

export interface AddPlaceSearchProps {
  closeHref: Route;
  query: string;
  onQueryChange: (query: string) => void;
  /** a pasted Maps link is being looked up */
  resolvingLink: boolean;
  suggestions: SuggestionRow[];
  searching: boolean;
  /** typed enough and Google found nothing */
  noResults: boolean;
  /** the row being opened */
  picking: string | null;
  onPick: (placeId: string) => void;
  /** null when there's no by-hand fallback (changing an existing place's Google place) */
  manualHref: Route | null;
  error: string | null;
  title: string;
}

/** 21a: one search box with Google Places Autocomplete */
export function AddPlaceSearch(props: AddPlaceSearchProps) {
  const { closeHref, query, onQueryChange, resolvingLink, suggestions, searching, noResults, picking, onPick, manualHref, error, title } =
    props;
  return (
    <div className="flex min-h-[calc(100dvh-3rem)] flex-col gap-5">
      <FormHeader
        title={title}
        back={
          <Link href={closeHref} aria-label="Close" className={iconButtonVariants({ variant: "surface" })}>
            <XIcon />
          </Link>
        }
      />
      <TextField
        label="Search Google Maps"
        placeholder="Search for a place, or paste a link"
        icon={resolvingLink || searching ? <LoaderCircleIcon className="animate-spin" aria-hidden /> : <SearchIcon aria-hidden />}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        autoFocus
        autoComplete="off"
        enterKeyHint="search"
        className="border-ink shadow-[0_0_0_1px_var(--color-ink)]"
        trailing={
          query ? (
            <IconButton label="Clear search" variant="ghost" size="sm" onClick={() => onQueryChange("")}>
              <XIcon />
            </IconButton>
          ) : null
        }
      />
      <InlineError>{error}</InlineError>

      {resolvingLink ? <p className="px-1 text-callout text-ink-muted">Finding that place on Google Maps…</p> : null}

      {suggestions.length ? (
        <div className="flex flex-col gap-2">
          <ul role="listbox" aria-label="Places on Google Maps" className="overflow-hidden rounded-card bg-surface shadow-card">
            {suggestions.map((s) => (
              <li key={s.placeId} role="option" aria-selected={picking === s.placeId} className="border-line not-last:border-b">
                <button
                  type="button"
                  onClick={() => onPick(s.placeId)}
                  disabled={picking !== null}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-muted",
                    picking === s.placeId && "bg-surface-muted",
                  )}
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-ink [&_svg]:size-[18px]">
                    {picking === s.placeId ? (
                      <LoaderCircleIcon className="animate-spin" aria-hidden />
                    ) : s.road ? (
                      <NavigationIcon aria-hidden />
                    ) : (
                      <MapPinIcon aria-hidden />
                    )}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-body-strong">
                      {s.parts.map((part, i) =>
                        part.match ? (
                          <mark key={i} className="bg-transparent text-accent">
                            {part.text}
                          </mark>
                        ) : (
                          <span key={i}>{part.text}</span>
                        ),
                      )}
                    </span>
                    <span className="truncate text-caption text-ink-muted">{s.secondary}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="px-1 text-right text-caption text-ink-subtle">Google Maps</p>
        </div>
      ) : noResults ? (
        <p className="px-1 text-callout text-ink-muted">Nothing on Google Maps matches that. Try another spelling, or add it by hand.</p>
      ) : null}

      <div className="mt-auto flex flex-col gap-3 pb-2">
        <p className="flex items-center gap-2.5 rounded-row border border-line px-4 py-3 text-caption text-ink-muted">
          <LinkIcon className="size-[18px] shrink-0" aria-hidden />
          Got a Google Maps link? Paste it in the search box.
        </p>
        {manualHref ? (
          <Link href={manualHref} className="py-3 text-center text-callout text-ink-muted hover:text-ink">
            Can&apos;t find it? Add it by hand
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export interface AddPlacePreviewProps {
  title: string;
  onBack: () => void;
  place: PlacePreview | null;
  /** null when changing an existing place's Google place: kind and status stay as they are */
  kind: string | null;
  onKindChange: (kind: string) => void;
  status: PlaceStatus | null;
  onStatusChange: (status: PlaceStatus) => void;
  submitLabel: string;
  onSubmit: () => void;
  pending: boolean;
  error: string | null;
}

/** 21b: the place picked from the search, ready to add */
export function AddPlacePreview(props: AddPlacePreviewProps) {
  const { title, onBack, place, kind, onKindChange, status, onStatusChange, submitLabel, onSubmit, pending, error } = props;
  return (
    <div className="flex min-h-[calc(100dvh-3rem)] flex-col gap-5">
      <FormHeader
        title={title}
        back={
          <IconButton label="Back to search" onClick={onBack}>
            <ChevronLeftIcon />
          </IconButton>
        }
      />
      <AnimatePresence mode="wait">
        {place ? (
          <motion.article
            key="place"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="overflow-hidden rounded-card bg-surface shadow-card"
          >
            <div className="relative h-36 bg-linear-135 from-[#ff9f7a] to-[#e59e2e]">
              {place.photo ? <Photo src={place.photo.url} sizes="(max-width: 440px) 100vw, 440px" /> : null}
              {place.photo ? <PhotoCredit photo={place.photo} /> : null}
            </div>
            <div className="flex flex-col gap-2 p-4">
              <h2 className="text-title">{place.name}</h2>
              <p className="text-caption text-ink-muted">{place.address}</p>
              <div className="flex flex-wrap gap-1.5">
                {place.rating ? (
                  <Chip tone="warning">
                    <StarIcon className="fill-current" aria-hidden />
                    {place.rating} on Google
                  </Chip>
                ) : null}
                {place.price ? <Chip aria-label={`Price level ${place.price.length}`}>{place.price}</Chip> : null}
                {place.hours ? <Chip tone={place.hours.open ? "success" : "neutral"}>{place.hours.text}</Chip> : null}
              </div>
            </div>
          </motion.article>
        ) : (
          <Skeleton key="loading" className="h-[248px] rounded-card" />
        )}
      </AnimatePresence>

      {kind !== null ? (
        <div className="flex flex-col gap-2">
          <FieldLabel>Kind</FieldLabel>
          <KindPicker value={kind} onChange={onKindChange} />
          <p className="text-caption text-ink-muted">Picked from Google&apos;s type. Change it if you like.</p>
        </div>
      ) : null}

      {status ? (
        <div className="flex flex-col gap-2">
          <FieldLabel>Status</FieldLabel>
          <StatusPicker value={status} onChange={onStatusChange} />
        </div>
      ) : null}

      <InlineError>{error}</InlineError>

      <div className="mt-auto flex flex-col gap-2 pb-2">
        <Button block onClick={onSubmit} pending={pending} disabled={!place}>
          {submitLabel}
        </Button>
        <button type="button" onClick={onBack} className="py-3 text-callout text-ink-muted hover:text-ink">
          Not this one? Search again
        </button>
      </div>
    </div>
  );
}

/** Google asks for its name on every photo, and the photographer's when there is one */
function PhotoCredit({ photo }: { photo: NonNullable<PlacePreview["photo"]> }) {
  const label = photo.credit ? `Photo: ${photo.credit} · Google Maps` : "Photo: Google Maps";
  const className = "absolute bottom-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-caption text-white";
  return photo.creditUrl ? (
    <a href={photo.creditUrl} target="_blank" rel="noreferrer" className={className}>
      {label}
    </a>
  ) : (
    <span className={className}>{label}</span>
  );
}
