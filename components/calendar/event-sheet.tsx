"use client";

import Link from "next/link";
import type { Route } from "next";
import { ChevronRightIcon, ClockIcon, MapPinIcon, PencilIcon, Trash2Icon } from "lucide-react";
import type { Member } from "@/lib/models";
import { AvatarStack } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/layout";
import { Sheet } from "@/components/ui/sheet";

export interface EventSheetData {
  id: string;
  title: string;
  /** "Fri 6 Nov · 19:30" */
  when: string;
  where: string | null;
  people: Member[];
  /** a plan to go to one of your places: opens it */
  place: { name: string; href: Route } | null;
}

export function EventSheet({
  event,
  onClose,
  onEdit,
  onDelete,
  pending,
  error,
}: {
  event: EventSheetData | null;
  onClose: () => void;
  /** opens the plan in the add sheet to change it */
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  pending: boolean;
  error: string | null;
}) {
  return (
    <Sheet open={event !== null} onOpenChange={(open) => !open && onClose()} eyebrow="Plan" title={event?.title ?? ""}>
      {event ? (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3 rounded-card bg-surface-muted p-4 text-callout">
            <span className="flex items-center gap-2.5">
              <ClockIcon className="size-4 text-ink-muted" aria-hidden />
              {event.when}
            </span>
            {event.where ? (
              <span className="flex items-center gap-2.5">
                <MapPinIcon className="size-4 text-ink-muted" aria-hidden />
                {event.where}
              </span>
            ) : null}
            {event.people.length ? (
              <span className="flex items-center gap-2.5">
                <AvatarStack members={event.people} />
                {event.people.map((p) => p.name).join(" & ")}
              </span>
            ) : null}
          </div>
          {event.place ? (
            <Link href={event.place.href} className="flex items-center gap-3 rounded-row bg-surface px-4 py-3.5">
              <MapPinIcon className="size-[18px] shrink-0 text-partner" aria-hidden />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-caption text-ink-muted">A plan to go to</span>
                <span className="truncate text-body-strong">{event.place.name}</span>
              </span>
              <ChevronRightIcon className="size-[18px] shrink-0 text-ink-subtle" aria-hidden />
            </Link>
          ) : null}
          <InlineError>{error}</InlineError>
          <Button block onClick={() => onEdit(event.id)}>
            <PencilIcon className="size-4" aria-hidden />
            Edit plan
          </Button>
          <Button block variant="outline" pending={pending} onClick={() => onDelete(event.id)}>
            <Trash2Icon className="size-4" aria-hidden />
            Remove from calendar
          </Button>
        </div>
      ) : null}
    </Sheet>
  );
}
