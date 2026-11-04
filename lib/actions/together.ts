"use server";

import { serverBackend } from "@/lib/backend/server";
import type { MemberRole } from "@/lib/models";

// Server actions: the only bridge from view-models (client) to serverBackend.

export async function getTogether() {
  return serverBackend.getTogether();
}

export async function createTogether(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return { data: null, error: "Give your Together a name." };
  return serverBackend.createTogether({ name: trimmed.slice(0, 60) });
}

export async function renameTogether(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return { success: false, error: "Give your Together a name." };
  return serverBackend.renameTogether({ name: trimmed.slice(0, 60) });
}

export async function joinTogether(code: string) {
  if (code.replace(/[^a-z0-9]/gi, "").length < 6) return { data: null, error: "Invite codes are 6 letters and numbers." };
  return serverBackend.joinTogether({ code });
}

export async function getInvitePreview(code: string) {
  return serverBackend.getInvitePreview({ code });
}

export async function listMyTogethers() {
  return serverBackend.listMyTogethers();
}

export async function switchTogether(id: string) {
  return serverBackend.switchTogether({ id });
}

export async function newInviteCode() {
  return serverBackend.newInviteCode();
}

export async function removeMember(memberId: string) {
  return serverBackend.removeMember({ memberId });
}

export async function setMemberRole(memberId: string, role: MemberRole) {
  if (role !== "owner" && role !== "member") return { success: false, error: "That isn't a role." };
  return serverBackend.setMemberRole({ memberId, role });
}

export async function leaveTogether() {
  return serverBackend.leaveTogether();
}
