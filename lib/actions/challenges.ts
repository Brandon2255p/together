"use server";

import { serverBackend } from "@/lib/backend/server";
import { periodStartOf } from "@/lib/challenges/streak";
import type { NewChallenge } from "@/lib/models";

export async function getChallenges() {
  return serverBackend.getChallenges();
}

export async function getChallenge(id: string) {
  return serverBackend.getChallenge({ id });
}

export async function addChallenge(challenge: NewChallenge) {
  const title = challenge.title.trim();
  if (!title) return { data: null, error: "Give the challenge a name." };
  const goals = challenge.goals
    .map((g) => ({ title: g.title.trim().slice(0, 120), target: Math.min(99, Math.max(1, Math.round(g.target))) }))
    .filter((g) => g.title);
  if (!goals.length) return { data: null, error: "Add at least one goal." };
  if (!challenge.memberIds.length) return { data: null, error: "Pick who's in it." };
  if (periodStartOf(challenge.cadence, challenge.startsOn) !== challenge.startsOn) {
    return { data: null, error: "Weekly challenges start on a Monday, monthly ones on the 1st." };
  }
  return serverBackend.addChallenge({ ...challenge, title: title.slice(0, 120), goals });
}

export async function setChallengeGoalCount(goalId: string, count: number) {
  return serverBackend.setChallengeGoalCount({ goalId, count: Math.max(0, Math.round(count)) });
}

export async function settleMissedPeriod(id: string, useBooster: boolean) {
  return serverBackend.settleMissedPeriod({ id, useBooster });
}

export async function deleteChallenge(id: string) {
  return serverBackend.deleteChallenge({ id });
}
