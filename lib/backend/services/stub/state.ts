import "server-only";
import type { PushSubscriptionKeys } from "@/lib/models";
import { blankState, seedWorld, type StubState, type StubWorld } from "@/lib/backend/services/stub/seed";

// The stub's memory, shared by the server and jobs stubs: every Together it knows, which one is open, and Brandon's
// push subscriptions (a person's, not a Together's). Kept across hot reloads on globalThis.

export interface StubMemory extends StubWorld {
  pushSubscriptions: (PushSubscriptionKeys & { memberId: string })[];
}

const g = globalThis as unknown as { __togetherStubWorld?: StubMemory };
export const world = (): StubMemory => (g.__togetherStubWorld ??= { ...seedWorld(), pushSubscriptions: [] });

const NONE = blankState(null);

/** the open Together's data (an empty one when there's none) */
export const state = (): StubState => {
  const w = world();
  return (w.currentId && w.togethers[w.currentId]) || NONE;
};
