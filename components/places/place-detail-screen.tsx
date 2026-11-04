"use client";

import Link from "next/link";
import type { Route } from "next";
import { motion, useScroll, useTransform } from "motion/react";
import { ChevronLeftIcon, ChevronRightIcon, EllipsisIcon, MapPinIcon, NavigationIcon, StarIcon } from "lucide-react";
import type { Hue, Member } from "@/lib/models";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { iconButtonVariants } from "@/components/ui/icon-button";
import { SectionHeader } from "@/components/ui/layout";
import { Reveal, RevealItem } from "@/components/ui/motion";
import { Photo } from "@/components/ui/photo";
import { Rating } from "@/components/ui/thumb";
import { cn } from "@/lib/utils";

const HERO: Record<Hue, string> = {
  accent: "from-[#ff8c6b] to-[#ffd9c7]",
  partner: "from-[#7480ff] to-[#d5d8ff]",
  success: "from-[#35a878] to-[#c9eed8]",
  warning: "from-[#e59e2e] to-[#ffe6bd]",
};

/** a photo from Google, shown with its photographer's credit (Google requires it) */
export interface PlacePhoto {
  url: string;
  credit: string | null;
  creditUrl: string | null;
}

export interface PlaceAddressCard {
  /** street and suburb */
  line1: string;
  /** city · province · country */
  line2: string | null;
  /** today's hours, when Google knows them */
  hours: { text: string; open: boolean } | null;
  /** opens the place in Google Maps */
  href: string;
  /** shows Google's attribution */
  fromGoogle: boolean;
}

export interface PlaceDetailScreenProps {
  name: string;
  hue: Hue;
  /** fills the hero when there is one */
  photo: PlacePhoto | null;
  /** the rating on Google Maps */
  googleRating: number | null;
  tags: { label: string; tone: "neutral" | "success" | "partner" }[];
  ratings: { member: Member; value: number | null }[];
  address: PlaceAddressCard;
  visits: { id: string; day: string; month: string; title: string; note: string | null; rating: number | null }[];
  backHref: Route;
  /** Edit place (22) */
  editHref: Route;
  onLogVisit: () => void;
}

export function PlaceDetailScreen(props: PlaceDetailScreenProps) {
  const { name, hue, photo, googleRating, tags, ratings, address, visits, backHref, editHref, onLogVisit } = props;
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 300], [0, 90]);
  const pinScale = useTransform(scrollY, [0, 200], [1, 0.8]);

  return (
    <div className="-mx-5 -mt-[max(1.5rem,env(safe-area-inset-top))]">
      <motion.div
        style={{ y: heroY }}
        className={cn("relative grid h-[300px] place-items-center overflow-hidden bg-linear-135", HERO[hue])}
      >
        <motion.span style={{ scale: pinScale }} className="text-on-accent">
          <MapPinIcon className="size-14" strokeWidth={1.5} aria-hidden />
        </motion.span>
        {photo ? (
          <>
            <Photo src={photo.url} sizes="(max-width: 440px) 100vw, 440px" priority />
            {/* keeps the back button readable on a bright photo */}
            <div className="absolute inset-x-0 top-0 h-28 bg-linear-to-b from-black/30 to-transparent" aria-hidden />
            <PhotoCredit photo={photo} />
          </>
        ) : null}
        <div className="absolute inset-x-5 top-[max(1rem,env(safe-area-inset-top))] flex justify-between">
          <Link href={backHref} aria-label="Back to places" className={iconButtonVariants({ variant: "glass" })}>
            <ChevronLeftIcon />
          </Link>
          <Link href={editHref} aria-label="Edit place" className={iconButtonVariants({ variant: "glass" })}>
            <EllipsisIcon />
          </Link>
        </div>
      </motion.div>

      <Reveal className="relative -mt-8 flex flex-col gap-5 rounded-t-sheet bg-bg px-5 pt-6">
        <RevealItem className="flex flex-col gap-2">
          <h1 className="text-display-l">{name}</h1>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <Chip key={t.label} tone={t.tone}>
                {t.label}
              </Chip>
            ))}
            {googleRating !== null ? (
              <Chip tone="warning">
                <Rating value={googleRating} className="text-inherit" />
                <span>Google</span>
              </Chip>
            ) : null}
          </div>
        </RevealItem>

        <RevealItem className="flex gap-2.5">
          {ratings.map(({ member, value }) => (
            <div key={member.id} className="flex flex-1 items-center gap-2.5 rounded-row bg-surface p-3">
              <Avatar member={member} />
              <span className="flex flex-col">
                <span className="text-caption text-ink-muted">{member.name}</span>
                {value !== null ? (
                  <Rating value={value} className="text-body-strong [&_svg]:size-4" />
                ) : (
                  <span className="flex items-center gap-1 text-callout text-ink-subtle">
                    <StarIcon className="size-4" aria-hidden /> Not yet
                  </span>
                )}
              </span>
            </div>
          ))}
        </RevealItem>

        <RevealItem className="flex flex-col gap-1.5">
          <a
            href={address.href}
            target="_blank"
            rel="noreferrer"
            aria-label={`${address.line1}. Open in Google Maps`}
            className="flex items-center gap-3 rounded-row bg-surface px-4 py-3.5"
          >
            <NavigationIcon className="size-[18px] shrink-0 text-partner" aria-hidden />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-body-strong">{address.line1}</span>
              {address.line2 ? <span className="truncate text-caption text-ink-muted">{address.line2}</span> : null}
              {address.hours ? (
                <span className={cn("text-caption", address.hours.open ? "text-success-ink" : "text-ink-muted")}>
                  {address.hours.text}
                </span>
              ) : null}
            </span>
            <ChevronRightIcon className="size-[18px] shrink-0 text-ink-subtle" aria-hidden />
          </a>
          {address.fromGoogle ? <p className="px-1 text-right text-caption text-ink-subtle">Google Maps</p> : null}
        </RevealItem>

        <RevealItem className="flex flex-col gap-3 pb-4">
          <SectionHeader title={`Visits · ${visits.length}`} />
          {visits.length === 0 ? (
            <p className="rounded-row bg-surface px-4 py-4 text-callout text-ink-muted">
              No visits logged yet. Log one when you go.
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {visits.map((v) => (
                <li key={v.id} className="flex gap-3.5 rounded-row bg-surface px-4 py-3.5">
                  <span className="flex w-10 shrink-0 flex-col items-center">
                    <span className="text-title">{v.day}</span>
                    <span className="text-caption text-ink-muted">{v.month}</span>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-body-strong">{v.title}</span>
                      {v.rating !== null ? <Rating value={v.rating} /> : null}
                    </span>
                    {v.note ? <span className="text-caption font-normal text-ink-muted">{v.note}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Button block onClick={onLogVisit} className="mt-2">
            Log a visit
          </Button>
        </RevealItem>
      </Reveal>
    </div>
  );
}

/** "Photo: Thandi M. · Google Maps", linking to the photographer's profile when Google gives one */
function PhotoCredit({ photo }: { photo: PlacePhoto }) {
  const label = photo.credit ? `Photo: ${photo.credit} · Google Maps` : "Photo: Google Maps";
  const className = "absolute bottom-12 left-5 rounded-full bg-black/60 px-2.5 py-1 text-caption text-white";
  return photo.creditUrl ? (
    <a href={photo.creditUrl} target="_blank" rel="noreferrer" className={className}>
      {label}
    </a>
  ) : (
    <span className={className}>{label}</span>
  );
}
