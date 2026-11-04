"use client";

import { useEffect, useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { leaveTogether, newInviteCode, removeMember, renameTogether, setMemberRole } from "@/lib/actions/together";
import type { Member, Together } from "@/lib/models";
import { codeBoxes, expiryLabel, inviteMessage, isExpired, joinUrl, spacedCode } from "@/lib/together/invite";
import type { MemberRowData } from "@/components/together/together-screen";

const peopleCount = (n: number) => (n === 1 ? "Just you" : `${n} people`);

export function useTogetherViewModel(initial: Together) {
  const router = useRouter();
  const [together, setTogether] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [copyNote, setCopyNote] = useState<string | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [draftName, setDraftName] = useState(initial.name);
  const [pending, setPending] = useState(false);
  // the clock for expiry labels; read after mount so server and client render the same
  const [now, setNow] = useState<number | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 60_000);
    setTimeout(() => setOrigin(window.location.origin), 0);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  const me = together.members.find((m) => m.id === together.meId);
  const iOwn = me?.role === "owner";
  const owners = together.members.filter((m) => m.role === "owner");
  const expired = now !== null && isExpired(together.inviteExpiresAt, now);
  const link = joinUrl(origin, together.inviteCode);
  const sheetMember = together.members.find((m) => m.id === memberId) ?? null;

  function flash(note: string) {
    setCopyNote(note);
    setTimeout(() => setCopyNote(null), 2000);
  }

  async function copy(text: string, note: string) {
    try {
      await navigator.clipboard.writeText(text);
      flash(note);
    } catch {
      setError("Couldn't copy. Select the code and copy it yourself.");
    }
  }

  async function share() {
    const text = inviteMessage(together.name, link, together.inviteCode);
    try {
      if (navigator.share) {
        await navigator.share({ title: `Join ${together.name} on Together`, text, url: link });
        return;
      }
      await copy(text, "Invite copied ✓");
    } catch {
      // the share sheet was dismissed
    }
  }

  function updateMember(id: string, change: (m: Member) => Member | null) {
    setTogether((t) => ({
      ...t,
      members: t.members.flatMap((m) => {
        if (m.id !== id) return [m];
        const next = change(m);
        return next ? [next] : [];
      }),
    }));
  }

  function closeMember() {
    setMemberId(null);
    setConfirmingRemove(false);
    setError(null);
  }

  async function makeOwner() {
    if (!sheetMember || pending) return;
    const before = together;
    setPending(true);
    updateMember(sheetMember.id, (m) => ({ ...m, role: "owner" }));
    const result = await setMemberRole(sheetMember.id, "owner");
    setPending(false);
    if (!result.success) {
      setTogether(before);
      setError(result.error ?? "That didn't work. Try again.");
      return;
    }
    closeMember();
    router.refresh();
  }

  async function remove() {
    if (!sheetMember || pending) return;
    if (!confirmingRemove) {
      setConfirmingRemove(true);
      return;
    }
    const before = together;
    const gone = sheetMember;
    setPending(true);
    setTogether((t) => ({
      ...t,
      members: t.members.filter((m) => m.id !== gone.id),
      formerMembers: [...t.formerMembers, { ...gone, role: "member" }],
    }));
    const result = await removeMember(gone.id);
    setPending(false);
    if (!result.success) {
      setTogether(before);
      setError(result.error ?? "We couldn't remove them. Try again.");
      return;
    }
    closeMember();
    router.refresh();
  }

  async function renewCode() {
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await newInviteCode();
    setPending(false);
    if (!result.data) return setError(result.error ?? "We couldn't make a new code. Try again.");
    const fresh = result.data;
    setTogether((t) => ({ ...t, inviteCode: fresh.code, inviteExpiresAt: fresh.expiresAt }));
  }

  async function rename() {
    const name = draftName.trim();
    if (pending || !name) return;
    if (name === together.name) return setRenameOpen(false);
    const before = together.name;
    setPending(true);
    setError(null);
    setTogether((t) => ({ ...t, name }));
    const result = await renameTogether(name);
    setPending(false);
    if (!result.success) {
      setTogether((t) => ({ ...t, name: before }));
      return setError(result.error ?? "We couldn't rename it. Try again.");
    }
    setRenameOpen(false);
    // Home's pill and the switcher show the name too
    router.refresh();
  }

  async function leave() {
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await leaveTogether();
    if (!result.data) {
      setPending(false);
      return setError(result.error ?? "We couldn't take you out of it. Try again.");
    }
    router.replace(result.data.nextTogetherId ? "/home" : "/onboarding/together");
    router.refresh();
  }

  const members: MemberRowData[] = together.members.map((m) => ({
    member: m,
    detail: m.id === together.meId ? "You" : "",
    canManage: iOwn && m.id !== together.meId,
  }));

  const alone = together.members.length === 1;
  const lastOwner = iOwn && owners.length === 1 && !alone;

  return {
    name: together.name,
    summary: peopleCount(together.members.length),
    back: "/home" as Route,
    members,
    inviteCode: spacedCode(together.inviteCode),
    inviteExpiry: now === null ? "Works for 48 hours" : expiryLabel(together.inviteExpiresAt, now),
    inviteExpired: expired,
    copyNote,
    onCopy: () => void copy(together.inviteCode, "Copied ✓"),
    onShare: () => void share(),
    onOpenInvite: () => {
      setError(null);
      setInviteOpen(true);
    },
    onOpenMember: (id: string) => {
      setError(null);
      setConfirmingRemove(false);
      setMemberId(id);
    },
    leave: {
      open: leaveOpen,
      body: alone
        ? `You're the only one here, so leaving deletes ${together.name} and everything in it.`
        : "What you added stays for everyone else. You can come back with a new invite.",
      blocked: lastOwner ? "You're the only owner. Make someone else an owner first, then you can leave." : null,
      pending,
    },
    onLeaveOpenChange: (open: boolean) => {
      setError(null);
      setLeaveOpen(open);
    },
    onLeave: () => void leave(),
    memberSheet: sheetMember ? { member: sheetMember, confirmingRemove, pending } : null,
    onMemberSheetClose: closeMember,
    onMakeOwner: () => void makeOwner(),
    onRemove: () => void remove(),
    invite: inviteOpen
      ? {
          boxes: codeBoxes(together.inviteCode),
          link,
          expiry: now === null ? "Works for 48 hours" : expiryLabel(together.inviteExpiresAt, now),
          expired,
          canRenew: iOwn,
          pending,
        }
      : null,
    onInviteClose: () => setInviteOpen(false),
    onNewCode: () => void renewCode(),
    rename: { open: renameOpen, value: draftName, pending },
    onRenameOpenChange: (open: boolean) => {
      setError(null);
      if (open) setDraftName(together.name);
      setRenameOpen(open);
    },
    onRenameValueChange: (value: string) => {
      setDraftName(value);
      setError(null);
    },
    onRename: () => void rename(),
    error,
  };
}
