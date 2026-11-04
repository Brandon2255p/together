"use client";

import Link from "next/link";
import type { Route } from "next";
import { motion, useScroll, useTransform } from "motion/react";
import { ChevronLeftIcon, ChevronRightIcon, MapPinIcon, NavigationIcon, StarIcon } from "lucide-react";
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

export interface PlaceDetailScreenProps {
  name: string;
  hue: Hue;
  /** fills the hero when there is one */
  photoUrl: string | null;
  /** the rating on Google Maps */
  googleRating: number | null;
  tags: { label: string; tone: "neutral" | "success" | "partner" }[];
  ratings: { member: Member; value: number | null }[];
  mapsUrl: string | null;
  visits: { id: string; day: string; month: string; title: string; note: string | null; rating: number | null }[];
  backHref: Route;
  onLogVisit: () => void;
}

export function PlaceDetailScreen(props: PlaceDetailScreenProps) {
  const { name, hue, photoUrl, googleRating, tags, ratings, mapsUrl, visits, backHref, onLogVisit } = props;
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
        {photoUrl ? <Photo src={photoUrl} sizes="(max-width: 440px) 100vw, 440px" priority /> : null}
        {/* keeps the back button readable on a bright photo */}
        {photoUrl ? <div className="absolute inset-x-0 top-0 h-28 bg-linear-to-b from-black/30 to-transparent" aria-hidden /> : null}
        <div className="absolute inset-x-5 top-[max(1rem,env(safe-area-inset-top))] flex justify-between">
          <Link href={backHref} aria-label="Back to places" className={iconButtonVariants({ variant: "glass" })}>
            <ChevronLeftIcon />
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
              <Chip>
                <Rating value={googleRating} className="text-inherit" />
                <span>on Google</span>
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

        {mapsUrl ? (
          <RevealItem>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-row bg-surface px-4 py-3.5 text-callout"
            >
              <NavigationIcon className="size-[18px] text-partner" aria-hidden />
              <span className="flex-1">Open in Google Maps</span>
              <ChevronRightIcon className="size-[18px] text-ink-subtle" aria-hidden />
            </a>
          </RevealItem>
        ) : null}

        <RevealItem className="flex flex-col gap-3 pb-4">
          <SectionHeader title={`Visits · ${visits.length}`} />
          {visits.length === 0 ? (
            <p className="rounded-row bg-surface px-4 py-4 text-callout text-ink-muted">
              You haven&apos;t been yet. Log it when you go.
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
