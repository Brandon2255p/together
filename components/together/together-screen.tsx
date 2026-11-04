"use client";

import Link from "next/link";
import type { Route } from "next";
import { AnimatePresence } from "motion/react";
import { ChevronLeftIcon, CopyIcon, LogOutIcon, ShareIcon, UserPlusIcon } from "lucide-react";
import type { Member } from "@/lib/models";
import { MemberRow } from "@/components/together/member-row";
import { Button } from "@/components/ui/button";
import { iconButtonVariants } from "@/components/ui/icon-button";
import { InlineError, ScreenHeader, SectionHeader } from "@/components/ui/layout";
import { ListItem, Reveal, RevealItem } from "@/components/ui/motion";
import { Sheet } from "@/components/ui/sheet";

export interface MemberRowData {
  member: Member;
  detail: string;
  /** owners get a ••• on everyone else's row */
  canManage: boolean;
}

export interface MemberSheetData {
  member: Member;
  /** remove asks again before it happens */
  confirmingRemove: boolean;
  pending: boolean;
}

export interface InviteSheetData {
  boxes: string[];
  link: string;
  expiry: string;
  expired: boolean;
  canRenew: boolean;
  pending: boolean;
}

export interface TogetherScreenProps {
  name: string;
  /** "3 people" */
  summary: string;
  back: Route;
  members: MemberRowData[];
  /** "K7Q · 29X" */
  inviteCode: string;
  inviteExpiry: string;
  inviteExpired: boolean;
  /** "Copied ✓" for a moment after copying or sharing */
  copyNote: string | null;
  onCopy: () => void;
  onShare: () => void;
  onOpenInvite: () => void;
  onOpenMember: (id: string) => void;
  /** what the Leave confirm says: what happens to their things, and where they go next */
  leave: { open: boolean; body: string; blocked: string | null; pending: boolean };
  onLeaveOpenChange: (open: boolean) => void;
  onLeave: () => void;
  memberSheet: MemberSheetData | null;
  onMemberSheetClose: () => void;
  onMakeOwner: () => void;
  onRemove: () => void;
  invite: InviteSheetData | null;
  onInviteClose: () => void;
  onNewCode: () => void;
  error: string | null;
}

/** Screen 14: who's in this Together, the invite code, and Leave. Sheets 15 (member actions) and 16 (invite). */
export function TogetherScreen(props: TogetherScreenProps) {
  const { name, summary, back, members, inviteCode, inviteExpiry, inviteExpired, copyNote, onCopy, onShare } = props;
  return (
    <Reveal className="flex flex-col gap-5">
      <RevealItem>
        <Link href={back} aria-label="Back to Home" className={iconButtonVariants({ variant: "surface", size: "md" })}>
          <ChevronLeftIcon aria-hidden />
        </Link>
      </RevealItem>
      <RevealItem>
        <ScreenHeader eyebrow={summary} title={name} />
      </RevealItem>

      <InlineError>{props.error}</InlineError>

      <RevealItem className="flex flex-col gap-3">
        <SectionHeader title="Members" />
        <ul className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {members.map((row) => (
              <ListItem key={row.member.id}>
                <MemberRow
                  member={row.member}
                  detail={row.detail}
                  onActions={row.canManage ? () => props.onOpenMember(row.member.id) : undefined}
                />
              </ListItem>
            ))}
          </AnimatePresence>
          <li>
            <button
              type="button"
              onClick={props.onOpenInvite}
              className="flex w-full items-center gap-3 rounded-row border border-dashed border-line px-4 py-3 text-left transition-colors hover:bg-surface"
            >
              <span className="grid size-10 place-items-center rounded-full bg-surface-muted text-ink-muted">
                <UserPlusIcon className="size-5" aria-hidden />
              </span>
              <span className="flex flex-col">
                <span className="text-body-strong">Invite someone</span>
                <span className="text-caption text-ink-muted">They join with a code or a link</span>
              </span>
            </button>
          </li>
        </ul>
      </RevealItem>

      <RevealItem className="flex flex-col items-center gap-1.5 rounded-card bg-surface px-5 py-6 shadow-card">
        <p className="text-overline text-ink-muted">Invite code</p>
        <p className={inviteExpired ? "text-display-xl tracking-[2px] text-ink-subtle line-through" : "text-display-xl tracking-[2px]"}>
          {inviteCode}
        </p>
        <p className="text-caption text-ink-muted">{inviteExpiry}</p>
        <div className="mt-3 flex w-full gap-2">
          <Button variant="soft" size="md" className="flex-1" onClick={onCopy} disabled={inviteExpired}>
            <CopyIcon className="size-4" aria-hidden />
            {copyNote ?? "Copy"}
          </Button>
          <Button size="md" className="flex-1" onClick={inviteExpired ? props.onOpenInvite : onShare}>
            <ShareIcon className="size-4" aria-hidden />
            {inviteExpired ? "New code" : "Share"}
          </Button>
        </div>
      </RevealItem>

      <RevealItem>
        <Button variant="ghost" block onClick={() => props.onLeaveOpenChange(true)} className="text-accent-ink">
          <LogOutIcon className="size-4" aria-hidden />
          Leave {name}
        </Button>
      </RevealItem>

      <MemberActionsSheet {...props} />
      <InviteSheet {...props} />
      <LeaveSheet {...props} />
    </Reveal>
  );
}

/** Screen 15: what an owner can do with someone else */
function MemberActionsSheet({ memberSheet, onMemberSheetClose, onMakeOwner, onRemove, error }: TogetherScreenProps) {
  const member = memberSheet?.member;
  return (
    <Sheet open={!!memberSheet} onOpenChange={(open) => !open && onMemberSheetClose()} title={member?.name ?? ""} eyebrow="Member">
      {memberSheet && member ? (
        <div className="flex flex-col gap-3">
          {memberSheet.confirmingRemove ? (
            <>
              <p className="text-body text-ink-muted">
                Remove {member.name} from this Together? What {member.name} added stays. {member.name} can come back with a new
                invite.
              </p>
              <Button variant="accent" block onClick={onRemove} pending={memberSheet.pending}>
                Yes, remove {member.name}
              </Button>
              <Button variant="ghost" block onClick={onMemberSheetClose}>
                Keep {member.name}
              </Button>
            </>
          ) : (
            <>
              {member.role === "owner" ? null : (
                <Button variant="soft" block onClick={onMakeOwner} pending={memberSheet.pending}>
                  Make owner
                </Button>
              )}
              <Button variant="outline" block onClick={onRemove} className="text-accent-ink">
                Remove from Together
              </Button>
            </>
          )}
          <InlineError>{error}</InlineError>
        </div>
      ) : null}
    </Sheet>
  );
}

/** Screen 16: the code in six boxes, the join link, Share, and (owners) a new code */
function InviteSheet({ invite, onInviteClose, onShare, onNewCode, copyNote, error }: TogetherScreenProps) {
  return (
    <Sheet open={!!invite} onOpenChange={(open) => !open && onInviteClose()} title="Invite someone" eyebrow={invite?.expiry}>
      {invite ? (
        <div className="flex flex-col gap-4">
          <div className="flex justify-between gap-2" aria-label={`Invite code ${invite.boxes.join(" ")}`} role="img">
            {invite.boxes.map((ch, i) => (
              <span
                key={i}
                className={
                  "grid h-14 flex-1 place-items-center rounded-field bg-surface-muted text-display-l " +
                  (invite.expired ? "text-ink-subtle" : "")
                }
              >
                {ch}
              </span>
            ))}
          </div>
          <p className="truncate rounded-field border border-line px-4 py-3 text-callout text-ink-muted">{invite.link}</p>
          <p className="text-caption text-ink-muted">
            They open the link, or sign in and enter the code. Codes work for 48 hours.
          </p>
          <Button block onClick={onShare} disabled={invite.expired}>
            <ShareIcon className="size-4" aria-hidden />
            {copyNote ?? "Share invite"}
          </Button>
          {invite.canRenew ? (
            <Button variant="ghost" block onClick={onNewCode} pending={invite.pending}>
              Make a new code
            </Button>
          ) : invite.expired ? (
            <p className="text-center text-caption text-ink-muted">This code has expired. Ask an owner for a new one.</p>
          ) : null}
          <InlineError>{error}</InlineError>
        </div>
      ) : null}
    </Sheet>
  );
}

function LeaveSheet({ name, leave, onLeaveOpenChange, onLeave, error }: TogetherScreenProps) {
  return (
    <Sheet open={leave.open} onOpenChange={onLeaveOpenChange} title={`Leave ${name}?`}>
      <div className="flex flex-col gap-3">
        {leave.blocked ? (
          <p className="text-body text-ink-muted">{leave.blocked}</p>
        ) : (
          <>
            <p className="text-body text-ink-muted">{leave.body}</p>
            <Button variant="accent" block onClick={onLeave} pending={leave.pending}>
              Leave
            </Button>
          </>
        )}
        <Button variant="ghost" block onClick={() => onLeaveOpenChange(false)}>
          {leave.blocked ? "OK" : "Stay"}
        </Button>
        <InlineError>{error}</InlineError>
      </div>
    </Sheet>
  );
}
