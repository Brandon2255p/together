import "server-only";
import { addDays } from "@/lib/format";
import type { ServerBackendService } from "@/lib/backend/interfaces/server";
import type {
  Chore,
  Coordinates,
  DataResult,
  InviteCode,
  InvitePreview,
  Member,
  MemberRole,
  MemberTone,
  MutationResult,
  NewPlace,
  Place,
  PlaceQuery,
  Together,
  TogetherSummary,
} from "@/lib/models";
import { stubFindPlace, stubGetPlace } from "@/lib/backend/services/stub/google";
import { BRANDON, blankState, seedWorld, type StubState, type StubWorld } from "@/lib/backend/services/stub/seed";

// The stub keeps its state in memory for the life of the server process (kept across hot reloads on globalThis): every
// Together it knows, and which one is open. state() is the open Together's data.
const g = globalThis as unknown as { __togetherStubWorld?: StubWorld };
const world = (): StubWorld => (g.__togetherStubWorld ??= seedWorld());
const NONE = blankState(null);
const state = (): StubState => {
  const w = world();
  return (w.currentId && w.togethers[w.currentId]) || NONE;
};

const LATENCY_MS = 120;
const wait = () => new Promise((r) => setTimeout(r, LATENCY_MS));

function log(action: string, params?: unknown) {
  console.log(`[stub] ${action}`, params === undefined ? "" : JSON.stringify(params));
}

const ok = <T>(data: T): DataResult<T> => ({ data: structuredClone(data) });
const fail = <T>(error: string): DataResult<T> => ({ data: null, error });
const done: MutationResult = { success: true };
const notDone = (error: string): MutationResult => ({ success: false, error });
const id = (prefix: string) => `${prefix}-${state().nextId++}`;

const NEXT_DUE = { once: 0, daily: 1, weekly: 7, monthly: 30 } as const;
const TONES: MemberTone[] = ["accent", "partner", "success", "warning"];
const ME = BRANDON.id;
const NO_TOGETHER = "You're not in a Together yet.";
const normalCode = (code: string) => code.replace(/[^a-z0-9]/gi, "").toUpperCase();
const in48Hours = () => new Date(Date.now() + 48 * 3_600_000).toISOString();
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode = () => Array.from({ length: 6 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join("");

/** the Togethers Brandon is in, in the order he joined them */
const mine = () => Object.values(world().togethers).filter((s) => s.together?.members.some((m) => m.id === ME));

/** opens a Together (or none), marking the one left and the one opened as seen */
function open(togetherId: string | null) {
  const w = world();
  const previous = w.currentId ? w.togethers[w.currentId] : undefined;
  if (previous) previous.hasNews = false;
  w.currentId = togetherId;
  if (togetherId && w.togethers[togetherId]) w.togethers[togetherId].hasNews = false;
}

/** the open Together and Brandon's membership, when he's an owner there */
function asOwner(): { together: Together } | { error: string } {
  const together = state().together;
  if (!together) return { error: NO_TOGETHER };
  if (together.members.find((m) => m.id === ME)?.role !== "owner") return { error: "Only an owner can do that." };
  return { together };
}

export class StubServerService implements ServerBackendService {
  async getTogether() {
    await wait();
    log("getTogether");
    const t = state().together;
    return t ? ok(t) : { data: null };
  }

  async createTogether({ name }: { name: string }) {
    await wait();
    log("createTogether", { name });
    const w = world();
    const togetherId = `t-${100 + Object.keys(w.togethers).length}`;
    const together: Together = {
      id: togetherId,
      name,
      members: [{ ...BRANDON, tone: "accent", role: "owner" }],
      formerMembers: [],
      meId: ME,
      inviteCode: newCode(),
      inviteExpiresAt: in48Hours(),
    };
    w.togethers[togetherId] = blankState(together, 100 * (Object.keys(w.togethers).length + 1));
    open(togetherId);
    return ok(together);
  }

  async renameTogether({ name }: { name: string }) {
    await wait();
    log("renameTogether", { name });
    const t = state().together;
    if (!t) return notDone(NO_TOGETHER);
    t.name = name;
    return done;
  }

  async joinTogether({ code }: { code: string }) {
    await wait();
    log("joinTogether", { code });
    const target = Object.values(world().togethers).find((s) => s.together?.inviteCode === normalCode(code));
    const together = target?.together;
    if (!target || !together) return fail<Together>("That code didn't work. Check it with whoever sent it and try again.");
    if (!together.members.some((m) => m.id === ME)) {
      if (Date.parse(together.inviteExpiresAt) < Date.now()) return fail<Together>("That code has expired. Ask for a new one.");
      const before = together.formerMembers.find((m) => m.id === ME);
      together.formerMembers = together.formerMembers.filter((m) => m.id !== ME);
      const count = together.members.length + together.formerMembers.length;
      together.members.push(before ? { ...before, role: "member" } : { ...BRANDON, tone: TONES[count % 4] ?? "accent", role: "member" });
    }
    open(together.id);
    return ok(together);
  }

  async getInvitePreview({ code }: { code: string }) {
    await wait();
    log("getInvitePreview", { code });
    const together = Object.values(world().togethers).find((s) => s.together?.inviteCode === normalCode(code))?.together;
    if (!together) return { data: null };
    return ok<InvitePreview>({
      togetherId: together.id,
      name: together.name,
      members: together.members,
      expired: Date.parse(together.inviteExpiresAt) < Date.now(),
      alreadyMember: together.members.some((m) => m.id === ME),
    });
  }

  async listMyTogethers() {
    await wait();
    log("listMyTogethers");
    const currentId = world().currentId;
    return ok<TogetherSummary[]>(
      mine().map((s) => {
        const t = s.together as Together;
        const me = t.members.find((m) => m.id === ME) as Member;
        return {
          id: t.id,
          name: t.name,
          memberCount: t.members.length,
          members: t.members.map(({ id: memberId, name, initial, tone }) => ({ id: memberId, name, initial, tone })),
          tone: me.tone,
          role: me.role,
          current: t.id === currentId,
          lastActivityAt: s.lastActivityAt,
          hasNews: t.id !== currentId && s.hasNews,
        };
      }),
    );
  }

  async switchTogether({ id: togetherId }: { id: string }) {
    await wait();
    log("switchTogether", { id: togetherId });
    if (!mine().some((s) => s.together?.id === togetherId)) return notDone("You're not in that Together.");
    open(togetherId);
    return done;
  }

  async newInviteCode() {
    await wait();
    log("newInviteCode");
    const owner = asOwner();
    if ("error" in owner) return fail<InviteCode>(owner.error);
    owner.together.inviteCode = newCode();
    owner.together.inviteExpiresAt = in48Hours();
    return ok<InviteCode>({ code: owner.together.inviteCode, expiresAt: owner.together.inviteExpiresAt });
  }

  async removeMember({ memberId }: { memberId: string }) {
    await wait();
    log("removeMember", { memberId });
    const owner = asOwner();
    if ("error" in owner) return notDone(owner.error);
    if (memberId === ME) return notDone("To go yourself, leave the Together instead.");
    const gone = owner.together.members.find((m) => m.id === memberId);
    if (!gone) return notDone("They're not in this Together.");
    owner.together.members = owner.together.members.filter((m) => m.id !== memberId);
    owner.together.formerMembers.push({ ...gone, role: "member" });
    return done;
  }

  async setMemberRole({ memberId, role }: { memberId: string; role: MemberRole }) {
    await wait();
    log("setMemberRole", { memberId, role });
    const owner = asOwner();
    if ("error" in owner) return notDone(owner.error);
    const target = owner.together.members.find((m) => m.id === memberId);
    if (!target) return notDone("They're not in this Together.");
    if (role === "member" && owner.together.members.filter((m) => m.role === "owner" && m.id !== memberId).length === 0) {
      return notDone("A Together needs an owner. Make someone else the owner first.");
    }
    target.role = role;
    return done;
  }

  async leaveTogether() {
    await wait();
    log("leaveTogether");
    const together = state().together;
    if (!together) return fail<{ nextTogetherId: string | null }>(NO_TOGETHER);
    const me = together.members.find((m) => m.id === ME) as Member;
    const others = together.members.filter((m) => m.id !== ME);
    if (others.length === 0) {
      delete world().togethers[together.id];
    } else if (me.role === "owner" && !others.some((m) => m.role === "owner")) {
      return fail<{ nextTogetherId: string | null }>("Make someone else the owner before you leave.");
    } else {
      together.members = others;
      together.formerMembers.push({ ...me, role: "member" });
    }
    const next = mine()[0]?.together?.id ?? null;
    world().currentId = next;
    return ok({ nextTogetherId: next });
  }

  async getShoppingItems() {
    await wait();
    log("getShoppingItems");
    return ok(state().shopping);
  }

  async getItemCatalog() {
    await wait();
    log("getItemCatalog");
    return ok(state().catalog);
  }

  async addShoppingItem({ name, quantity }: { name: string; quantity: number }) {
    await wait();
    log("addShoppingItem", { name, quantity });
    const s = state();
    const item = { id: id("s"), name, quantity, addedBy: ME, done: false };
    s.shopping.unshift(item);
    const entry = s.catalog.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (entry) entry.timesAdded++;
    else s.catalog.push({ name, timesAdded: 1, popular: false });
    return ok(item);
  }

  async setShoppingItemDone({ id: itemId, done: isDone }: { id: string; done: boolean }) {
    await wait();
    log("setShoppingItemDone", { id: itemId, done: isDone });
    const item = state().shopping.find((i) => i.id === itemId);
    if (!item) return { success: false, error: "That item was removed." };
    item.done = isDone;
    return done;
  }

  async clearDoneShoppingItems() {
    await wait();
    log("clearDoneShoppingItems");
    state().shopping = state().shopping.filter((i) => !i.done);
    return done;
  }

  async getChores() {
    await wait();
    log("getChores");
    return ok(state().chores);
  }

  async addChore(params: Omit<Chore, "id" | "done">) {
    await wait();
    log("addChore", params);
    const chore: Chore = { ...params, id: id("c"), done: false };
    state().chores.unshift(chore);
    return ok(chore);
  }

  async setChoreDone({ id: choreId, done: isDone }: { id: string; done: boolean }) {
    await wait();
    log("setChoreDone", { id: choreId, done: isDone });
    const chore = state().chores.find((c) => c.id === choreId);
    if (!chore) return fail<Chore>("That chore was removed.");
    if (isDone && chore.repeat !== "once" && chore.due) {
      // a recurring chore rolls on to its next due date
      chore.due = addDays(chore.due, NEXT_DUE[chore.repeat]);
      chore.done = false;
    } else {
      chore.done = isDone;
    }
    return ok(chore);
  }

  async getEvents({ from, to }: { from: string; to: string }) {
    await wait();
    log("getEvents", { from, to });
    return ok(state().events.filter((e) => e.day >= from && e.day <= to));
  }

  async getPlaces() {
    await wait();
    log("getPlaces");
    return ok(state().places);
  }

  async getPlace({ id: placeId }: { id: string }) {
    await wait();
    log("getPlace", { id: placeId });
    const place = state().places.find((p) => p.id === placeId);
    return place ? ok(place) : fail<Place>("We couldn't find that place.");
  }

  async addPlace(place: NewPlace) {
    await wait();
    log("addPlace", place);
    const hues = ["accent", "partner", "success", "warning"] as const;
    const s = state();
    const existing = place.googlePlaceId ? s.places.find((p) => p.googlePlaceId === place.googlePlaceId) : undefined;
    if (existing) return ok(existing);
    const added: Place = {
      id: id("p"),
      name: place.name,
      category: place.category ?? "Saved place",
      area: place.area || (place.mapsUrl ? "From Google Maps" : "Added by hand"),
      street: place.street,
      city: place.city,
      province: place.province,
      country: place.country,
      mapsUrl: place.mapsUrl,
      status: place.status,
      ratings: {},
      visits: [],
      hue: hues[s.places.length % hues.length] ?? "accent",
      googlePlaceId: place.googlePlaceId,
      location: place.location ? { ...place.location, fetchedAt: new Date().toISOString() } : null,
    };
    s.places.unshift(added);
    return ok(added);
  }

  async setPlaceLocation({ id: placeId, location }: { id: string; location: Coordinates }) {
    await wait();
    log("setPlaceLocation", { id: placeId, location });
    const place = state().places.find((p) => p.id === placeId);
    if (place) place.location = { ...location, fetchedAt: new Date().toISOString() };
    return place ? done : { success: false, error: "We couldn't find that place." };
  }

  /** no Google here: canned places (Nobu, Zeitz, Woodlands), or a made-up one for any other link */
  async findPlaceFromLink(query: PlaceQuery) {
    await wait();
    log("findPlaceFromLink", query);
    return stubFindPlace(query);
  }

  async getGooglePlace({ placeId, extras }: { placeId: string; extras: boolean; sessionToken?: string }) {
    await wait();
    log("getGooglePlace", { placeId, extras });
    return stubGetPlace(placeId, extras);
  }

  async getWishes({ ownerId }: { ownerId: string }) {
    await wait();
    log("getWishes", { ownerId });
    const me = state().together?.meId;
    const wishes = state().wishes.filter((w) => w.ownerId === ownerId);
    // surprises stay surprises: owners never learn who claimed their wishes
    return ok(ownerId === me ? wishes.map((w) => ({ ...w, claimedBy: null })) : wishes);
  }

  async getGoals() {
    await wait();
    log("getGoals");
    return ok(state().goals);
  }

  async setWishClaimed({ id: wishId, claimed }: { id: string; claimed: boolean }) {
    await wait();
    log("setWishClaimed", { id: wishId, claimed });
    const s = state();
    const wish = s.wishes.find((w) => w.id === wishId);
    const me = s.together?.meId;
    if (!wish || !me) return { success: false, error: "That wish was removed." };
    if (wish.ownerId === me) return { success: false, error: "You can't claim your own wish." };
    if (claimed && wish.claimedBy && wish.claimedBy !== me) return { success: false, error: "Someone already claimed it." };
    wish.claimedBy = claimed ? me : null;
    return done;
  }
}
