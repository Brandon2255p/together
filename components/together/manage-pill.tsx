"use client";

import Link from "next/link";
import type { Route } from "next";
import { ChevronRightIcon, UserPlusIcon } from "lucide-react";
import type { Member } from "@/lib/models";
import { AvatarStack } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/**
 * Beside the switcher pill on Home: who's in this Together, and the way into managing it (screen 14: members, invite,
 * rename, leave). On your own it asks you to invite someone instead.
 */
export function ManagePill({ name, members, href, className }: { name: string; members: Member[]; href: Route; className?: string }) {
  const alone = members.length <= 1;
  return (
    <Link
      href={href}
      aria-label={`Manage ${name}: members, invite code and name`}
      className={cn(
        "inline-flex items-center gap-2 rounded-chip border border-line bg-surface py-1 pr-2.5 pl-1 text-caption text-ink transition-transform active:scale-[0.97]",
        className
      )}
    >
      {alone ? (
        <span className="grid size-6 place-items-center rounded-full bg-accent-soft text-accent-ink">
          <UserPlusIcon className="size-3.5" aria-hidden />
        </span>
      ) : (
        <AvatarStack members={members.slice(0, 3)} size="sm" />
      )}
      <span className="font-semibold">{alone ? "Invite" : "Manage"}</span>
      <ChevronRightIcon className="size-3.5 text-ink-muted" aria-hidden />
    </Link>
  );
}
