"use client";

import { CheckIcon, CopyIcon, RefreshCwIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { InlineError } from "@/components/ui/layout";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface SyncLinks {
  /** https://…/api/calendar/<token>.ics, for copying into anything that reads .ics */
  feed: string;
  /** webcal://… opens Apple Calendar (or the device's calendar app) ready to subscribe */
  apple: string;
  /** Google Calendar's "add by URL", filled in */
  google: string;
}

export interface SyncSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null while the link loads */
  links: SyncLinks | null;
  copied: boolean;
  onCopy: () => void;
  /** makes a new link; anything subscribed with the old one stops updating */
  onReset: () => void;
  resetting: boolean;
  error: string | null;
}

export function SyncSheet({ open, onOpenChange, links, copied, onCopy, onReset, resetting, error }: SyncSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} eyebrow="Calendar" title="Sync to your calendar">
      <div className="flex flex-col gap-5">
        <p className="text-callout text-ink-muted">
          Subscribe once and your plans show up next to everything else, and keep up as they change. Apple Calendar checks
          for changes every few minutes; Google can take a few hours.
        </p>

        {links ? (
          <div className="flex flex-col gap-2.5">
            <a href={links.apple} className={buttonVariants({ block: true })}>
              Add to Apple Calendar
            </a>
            <a href={links.google} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", block: true })}>
              Add to Google Calendar
            </a>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5" aria-busy>
            <Skeleton className="h-[54px] rounded-full" />
            <Skeleton className="h-[54px] rounded-full" />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <span className="text-caption text-ink-muted">Or copy the link into Outlook or any calendar that takes one</span>
          <div className="flex items-center gap-2 rounded-row bg-surface-muted py-1.5 pl-4 pr-1.5">
            <span className={cn("min-w-0 flex-1 truncate text-caption", !links && "text-ink-subtle")}>{links?.feed ?? "Making your link…"}</span>
            <Button size="sm" variant="soft" className="bg-surface" disabled={!links} onClick={onCopy}>
              {copied ? <CheckIcon className="size-4" aria-hidden /> : <CopyIcon className="size-4" aria-hidden />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>

        <InlineError>{error}</InlineError>

        <div className="flex flex-col gap-1.5 border-t border-line pt-4">
          <p className="text-caption text-ink-muted">
            Anyone with this link can see your plans. If it got out, make a new one: calendars using the old link stop
            updating.
          </p>
          <Button variant="ghost" size="sm" className="self-start px-0" pending={resetting} disabled={!links} onClick={onReset}>
            <RefreshCwIcon className="size-4" aria-hidden />
            Make a new link
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
