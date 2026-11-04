import "server-only";
import { addDays } from "@/lib/format";
import type { ServerBackendService } from "@/lib/backend/interfaces/server";
import type { Chore, Coordinates, DataResult, MutationResult, NewPlace, NewVisit, Place, PlaceChanges, PlaceQuery, Together } from "@/lib/models";
import { stubAutocomplete, stubFindPlace, stubGetPlace } from "@/lib/backend/services/stub/google";
import { ADELE, BRANDON, seed, type StubState } from "@/lib/backend/services/stub/seed";

// The stub keeps its state in memory for the life of the server process (kept across hot reloads on globalThis).
const g = globalThis as unknown as { __togetherStub?: StubState };
const state = (): StubState => (g.__togetherStub ??= seed());

const LATENCY_MS = 120;
const wait = () => new Promise((r) => setTimeout(r, LATENCY_MS));

function log(action: string, params?: unknown) {
  console.log(`[stub] ${action}`, params === undefined ? "" : JSON.stringify(params));
}

const ok = <T>(data: T): DataResult<T> => ({ data: structuredClone(data) });
const fail = <T>(error: string): DataResult<T> => ({ data: null, error });
const done: MutationResult = { success: true };
const id = (prefix: string) => `${prefix}-${state().nextId++}`;

const NEXT_DUE = { once: 0, daily: 1, weekly: 7, monthly: 30 } as const;

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
    const together: Together = { id: id("t"), name, members: [BRANDON], meId: BRANDON.id, inviteCode: "K7Q29X" };
    state().together = together;
    return ok(together);
  }

  async renameTogether({ name }: { name: string }) {
    await wait();
    log("renameTogether", { name });
    const t = state().together;
    if (!t) return { success: false, error: "You're not in a Together yet." };
    t.name = name;
    return done;
  }

  async joinTogether({ code }: { code: string }) {
    await wait();
    log("joinTogether", { code });
    if (code.replace(/[^a-z0-9]/gi, "").toUpperCase() !== "K7Q29X") {
      return fail<Together>("That code didn't work. Check it with your person and try again.");
    }
    const together: Together = { id: "t-1", name: "Brandon & Adele", members: [BRANDON, ADELE], meId: BRANDON.id, inviteCode: "K7Q29X" };
    state().together = together;
    return ok(together);
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
    const item = { id: id("s"), name, quantity, addedBy: s.together?.meId ?? BRANDON.id, done: false };
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
      area: place.area,
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

  async updatePlace({ id: placeId, google, ...changes }: { id: string } & PlaceChanges) {
    await wait();
    log("updatePlace", { id: placeId, google, ...changes });
    const s = state();
    const place = s.places.find((p) => p.id === placeId);
    if (!place) return fail<Place>("We couldn't find that place.");
    if (google && s.places.some((p) => p.id !== placeId && p.googlePlaceId === google.placeId)) {
      return fail<Place>("That place is already in your list.");
    }
    Object.assign(place, changes);
    if (google) {
      place.googlePlaceId = google.placeId;
      place.location = google.location ? { ...google.location, fetchedAt: new Date().toISOString() } : null;
      place.street = "";
    }
    return ok(place);
  }

  async unlinkPlace({ id: placeId }: { id: string }) {
    await wait();
    log("unlinkPlace", { id: placeId });
    const place = state().places.find((p) => p.id === placeId);
    if (!place) return { success: false, error: "We couldn't find that place." };
    place.googlePlaceId = null;
    place.location = null;
    return done;
  }

  async deletePlace({ id: placeId }: { id: string }) {
    await wait();
    log("deletePlace", { id: placeId });
    const s = state();
    s.places = s.places.filter((p) => p.id !== placeId);
    return done;
  }

  async logVisit(visit: NewVisit) {
    await wait();
    log("logVisit", visit);
    const s = state();
    const place = s.places.find((p) => p.id === visit.placeId);
    if (!place) return fail<Place>("We couldn't find that place.");
    place.visits.unshift({ id: id("v"), day: visit.day, title: visit.title, note: visit.note, rating: visit.rating });
    place.visits.sort((a, b) => b.day.localeCompare(a.day));
    place.status = "been";
    const me = s.together?.meId ?? BRANDON.id;
    if (visit.rating !== null) place.ratings[me] = visit.rating;
    return ok(place);
  }

  async autocompletePlaces({ input, sessionToken, near }: { input: string; sessionToken: string; near: Coordinates | null }) {
    await wait();
    log("autocompletePlaces", { input, sessionToken, near });
    return stubAutocomplete(input);
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
