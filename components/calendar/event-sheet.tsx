"use client";

import { ClockIcon, MapPinIcon, Trash2Icon } from "lucide-react";
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
}

export function EventSheet({
  event,
  onClose,
  onDelete,
  pending,
  error,
}: {
  event: EventSheetData | null;
  onClose: () => void;
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
          <InlineError>{error}</InlineError>
          <Button block variant="outline" pending={pending} onClick={() => onDelete(event.id)}>
            <Trash2Icon className="size-4" aria-hidden />
            Remove from calendar
          </Button>
        </div>
      ) : null}
    </Sheet>
  );
}
