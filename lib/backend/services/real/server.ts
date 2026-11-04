import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import type { ServerBackendService } from "@/lib/backend/interfaces/server";
import type {
  CalendarEvent,
  CatalogEntry,
  Chore,
  ChoreRepeat,
  DataResult,
  DayKey,
  Goal,
  Hue,
  InviteCode,
  InvitePreview,
  Member,
  MemberId,
  MemberRole,
  MemberTone,
  MutationResult,
  NewChore,
  NewPlace,
  Coordinates,
  GooglePlaceDetails,
  Place,
  PlaceQuery,
  PlaceStatus,
  ShoppingItem,
  Together,
  TogetherSummary,
  WishItem,
} from "@/lib/models";
import { createClient } from "@/lib/supabase/server";
import { findPlaceId, getPlace as getGooglePlaceDetails } from "@/lib/google/places";

// The Supabase implementation. Every call runs as the signed-in user, so row-level security (supabase/schemas) decides
// what they see: queries never filter by Together themselves. Writes that need more than one table's rules go through
// the v1_ functions.

// ---- Rows, as selected below ------------------------------------------------

interface MemberRow {
  profile_id: string;
  tone: MemberTone;
  role: MemberRole;
  joined_at: string;
  left_at: string | null;
  profiles: { name: string } | null;
}
interface TogetherRow {
  id: string;
  name: string;
  invite_code: string;
  invite_expires_at: string;
  together_members: MemberRow[];
}
/** a member as v1_list_my_togethers and v1_invite_preview send them */
interface MemberJson {
  id: string;
  name: string;
  tone: MemberTone;
}
interface TogetherSummaryRow {
  id: string;
  name: string;
  member_count: number;
  members: MemberJson[];
  tone: MemberTone;
  role: MemberRole;
  is_current: boolean;
  last_activity_at: string;
  has_news: boolean;
}
interface InvitePreviewRow {
  id: string;
  name: string;
  members: MemberJson[];
  expired: boolean;
  already_member: boolean;
}
interface ShoppingRow {
  id: string;
  name: string;
  quantity: number;
  added_by: string | null;
  done_at: string | null;
}
interface CatalogRow {
  name: string;
  times_added: number;
  popular: boolean;
}
interface ChoreRow {
  id: string;
  title: string;
  due: string | null;
  repeat: ChoreRepeat;
  done_at: string | null;
  chore_assignees: { profile_id: string }[];
}
interface EventRow {
  id: string;
  title: string;
  day: string;
  start_time: string | null;
  location: string | null;
  event_attendees: { profile_id: string }[];
}
interface PlaceRow {
  id: string;
  name: string;
  category: string;
  area: string;
  maps_url: string | null;
  status: PlaceStatus;
  hue: Hue;
  street: string;
  city: string;
  province: string;
  country: string;
  google_place_id: string | null;
  lat: number | null;
  lng: number | null;
  location_fetched_at: string | null;
  place_ratings: { profile_id: string; rating: number }[];
  visits: { id: string; day: string; title: string; note: string | null; rating: number | null }[];
}
interface ClaimRow {
  claimed_by: string;
}
interface WishRow {
  id: string;
  owner_id: string;
  name: string;
  price_cents: number | null;
  url: string | null;
  hue: Hue;
  // one-to-one, but PostgREST may embed it as a list: the foreign key is (wish_id, together_id), the key is wish_id
  wish_claims: ClaimRow[] | ClaimRow | null;
}
interface GoalRow {
  id: string;
  title: string;
  saved_cents: number;
  target_cents: number;
  goal_owners: { profile_id: string }[];
}

const TOGETHER_SELECT =
  "id, name, invite_code, invite_expires_at, together_members (profile_id, tone, role, joined_at, left_at, profiles (name))";
const CHORE_SELECT = "id, title, due, repeat, done_at, chore_assignees (profile_id)";
const PLACE_SELECT =
  "id, name, category, area, street, city, province, country, maps_url, status, hue, google_place_id, lat, lng, location_fetched_at, place_ratings (profile_id, rating), visits (id, day, title, note, rating)";

// ---- Mapping rows to models ---------------------------------------------------

function toMember(row: MemberRow): Member {
  const name = row.profiles?.name ?? "Someone";
  return { id: row.profile_id, name, initial: name.charAt(0).toUpperCase(), tone: row.tone, role: row.role };
}

const fromJson = (m: MemberJson) => ({ id: m.id, name: m.name, initial: m.name.charAt(0).toUpperCase(), tone: m.tone });

function toTogether(row: TogetherRow, meId: MemberId): Together {
  const byJoin = [...row.together_members].sort((a, b) => a.joined_at.localeCompare(b.joined_at));
  return {
    id: row.id,
    name: row.name,
    members: byJoin.filter((m) => m.left_at === null).map(toMember),
    formerMembers: byJoin.filter((m) => m.left_at !== null).map(toMember),
    meId,
    inviteCode: row.invite_code,
    inviteExpiresAt: row.invite_expires_at,
  };
}

const toSummary = (row: TogetherSummaryRow): TogetherSummary => ({
  id: row.id,
  name: row.name,
  memberCount: row.member_count,
  members: row.members.map(fromJson),
  tone: row.tone,
  role: row.role,
  current: row.is_current,
  lastActivityAt: row.last_activity_at,
  hasNews: row.has_news,
});

const toShoppingItem = (row: ShoppingRow): ShoppingItem => ({
  id: row.id,
  name: row.name,
  quantity: row.quantity,
  addedBy: row.added_by ?? "",
  done: row.done_at !== null,
});

const toChore = (row: ChoreRow): Chore => ({
  id: row.id,
  title: row.title,
  due: row.due,
  repeat: row.repeat,
  assignees: row.chore_assignees.map((a) => a.profile_id),
  done: row.done_at !== null,
});

const toEvent = (row: EventRow): CalendarEvent => ({
  id: row.id,
  title: row.title,
  day: row.day,
  // Postgres sends time as HH:mm:ss
  time: row.start_time?.slice(0, 5) ?? null,
  location: row.location,
  attendees: row.event_attendees.map((a) => a.profile_id),
});

const toPlace = (row: PlaceRow): Place => ({
  id: row.id,
  name: row.name,
  category: row.category,
  area: row.area,
  mapsUrl: row.maps_url,
  status: row.status,
  ratings: Object.fromEntries(row.place_ratings.map((r) => [r.profile_id, r.rating])),
  visits: [...row.visits].sort((a, b) => b.day.localeCompare(a.day)),
  hue: row.hue,
  street: row.street,
  city: row.city,
  province: row.province,
  country: row.country,
  googlePlaceId: row.google_place_id,
  location:
    row.lat !== null && row.lng !== null && row.location_fetched_at
      ? { lat: row.lat, lng: row.lng, fetchedAt: row.location_fetched_at }
      : null,
});

function toWish(row: WishRow): WishItem {
  const claim = Array.isArray(row.wish_claims) ? row.wish_claims[0] : row.wish_claims;
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    price: row.price_cents === null ? null : Math.round(row.price_cents / 100),
    url: row.url,
    claimedBy: claim?.claimed_by ?? null,
    hue: row.hue,
  };
}

const toGoal = (row: GoalRow): Goal => ({
  id: row.id,
  title: row.title,
  saved: Math.round(row.saved_cents / 100),
  target: Math.round(row.target_cents / 100),
  ownerIds: row.goal_owners.map((o) => o.profile_id),
});

// ---- Results --------------------------------------------------------------------

// Errors raised by the v1_ functions are written for people (with these codes); anything else is a database detail,
// so it's logged and replaced with `fallback`.
const FRIENDLY_CODES = new Set(["P0001", "P0002", "23505", "23514", "42501"]);

function message(error: PostgrestError, fallback: string): string {
  const technical = /violates|constraint|relation|column|syntax|permission denied|row-level security/i.test(error.message);
  if (FRIENDLY_CODES.has(error.code) && !technical) return error.message;
  console.error("[supabase]", error.code, error.message);
  return fallback;
}

const ok = <T>(data: T): DataResult<T> => ({ data });
const fail = <T>(error: string): DataResult<T> => ({ data: null, error });
const saved: MutationResult = { success: true };
const notSaved = (error: string): MutationResult => ({ success: false, error });

const SIGNED_OUT = "Sign in again to carry on.";
const NO_TOGETHER = "You're not in a Together yet.";
const TRY_AGAIN = "That didn't work. Try again in a moment.";

/** the signed-in user's id, from their session token */
async function currentUserId(sb: Awaited<ReturnType<typeof createClient>>): Promise<string | null> {
  const { data } = await sb.auth.getClaims();
  return typeof data?.claims.sub === "string" ? data.claims.sub : null;
}

export class RealServerService implements ServerBackendService {
  // ---- Together ---------------------------------------------------------------

  async getTogether(): Promise<DataResult<Together>> {
    const sb = await createClient();
    const meId = await currentUserId(sb);
    if (!meId) return fail(SIGNED_OUT);
    // row-level security only shows the signed-in user's Together
    const { data, error } = await sb
      .from("togethers")
      .select(TOGETHER_SELECT)
      .maybeSingle()
      .overrideTypes<TogetherRow | null, { merge: false }>();
    if (error) return fail(message(error, "We couldn't load your Together."));
    return { data: data ? toTogether(data, meId) : null };
  }

  async createTogether({ name }: { name: string }): Promise<DataResult<Together>> {
    const sb = await createClient();
    const { error } = await sb.rpc("v2_create_together", { p_name: name });
    if (error) return fail(message(error, "We couldn't make your Together. Try again."));
    return this.getTogether();
  }

  async renameTogether({ name }: { name: string }): Promise<MutationResult> {
    const sb = await createClient();
    const together = await this.getTogether();
    if (!together.data) return notSaved(together.error ?? NO_TOGETHER);
    const { error } = await sb.from("togethers").update({ name }).eq("id", together.data.id);
    return error ? notSaved(message(error, "We couldn't rename it. Try again.")) : saved;
  }

  async joinTogether({ code }: { code: string }): Promise<DataResult<Together>> {
    const sb = await createClient();
    const { error } = await sb.rpc("v2_join_together", { p_code: code });
    if (error) return fail(message(error, "We couldn't join that Together. Try again."));
    return this.getTogether();
  }

  async getInvitePreview({ code }: { code: string }): Promise<DataResult<InvitePreview>> {
    const sb = await createClient();
    const { data, error } = await sb.rpc("v1_invite_preview", { p_code: code });
    if (error) return fail(message(error, "We couldn't check that code. Try again."));
    const row = (data as InvitePreviewRow[] | null)?.[0];
    if (!row) return { data: null };
    return ok({
      togetherId: row.id,
      name: row.name,
      members: row.members.map(fromJson),
      expired: row.expired,
      alreadyMember: row.already_member,
    });
  }

  async listMyTogethers(): Promise<DataResult<TogetherSummary[]>> {
    const sb = await createClient();
    const { data, error } = await sb.rpc("v1_list_my_togethers");
    if (error) return fail(message(error, "We couldn't load your Togethers."));
    return ok(((data as TogetherSummaryRow[] | null) ?? []).map(toSummary));
  }

  async switchTogether({ id }: { id: string }): Promise<MutationResult> {
    const sb = await createClient();
    const { error } = await sb.rpc("v1_switch_together", { p_together_id: id });
    return error ? notSaved(message(error, "We couldn't open that Together. Try again.")) : saved;
  }

  async newInviteCode(): Promise<DataResult<InviteCode>> {
    const sb = await createClient();
    const { data, error } = await sb.rpc("v1_new_invite_code");
    if (error) return fail(message(error, "We couldn't make a new code. Try again."));
    const row = (data as { invite_code: string; invite_expires_at: string }[] | null)?.[0];
    return row ? ok({ code: row.invite_code, expiresAt: row.invite_expires_at }) : fail(TRY_AGAIN);
  }

  async removeMember({ memberId }: { memberId: MemberId }): Promise<MutationResult> {
    const sb = await createClient();
    const { error } = await sb.rpc("v1_remove_member", { p_profile_id: memberId });
    return error ? notSaved(message(error, "We couldn't remove them. Try again.")) : saved;
  }

  async setMemberRole({ memberId, role }: { memberId: MemberId; role: MemberRole }): Promise<MutationResult> {
    const sb = await createClient();
    const { error } = await sb.rpc("v1_set_member_role", { p_profile_id: memberId, p_role: role });
    return error ? notSaved(message(error, TRY_AGAIN)) : saved;
  }

  async leaveTogether(): Promise<DataResult<{ nextTogetherId: string | null }>> {
    const sb = await createClient();
    const { data, error } = await sb.rpc("v1_leave_together");
    if (error) return fail(message(error, "We couldn't take you out of it. Try again."));
    return ok({ nextTogetherId: (data as string | null) ?? null });
  }

  // ---- Shopping -----------------------------------------------------------------

  async getShoppingItems(): Promise<DataResult<ShoppingItem[]>> {
    const sb = await createClient();
    const { data, error } = await sb
      .from("shopping_items")
      .select("id, name, quantity, added_by, done_at")
      .order("created_at", { ascending: false })
      .overrideTypes<ShoppingRow[], { merge: false }>();
    if (error) return fail(message(error, "We couldn't load the shopping list."));
    return ok(data.map(toShoppingItem));
  }

  async getItemCatalog(): Promise<DataResult<CatalogEntry[]>> {
    const sb = await createClient();
    const result = await sb.rpc("v1_item_catalog");
    if (result.error) return fail(message(result.error, "We couldn't load suggestions."));
    const rows = (result.data as CatalogRow[] | null) ?? [];
    return ok(rows.map((r) => ({ name: r.name, timesAdded: r.times_added, popular: r.popular })));
  }

  async addShoppingItem({ name, quantity }: { name: string; quantity: number }): Promise<DataResult<ShoppingItem>> {
    const sb = await createClient();
    // together_id and added_by default to the signed-in user's
    const { data, error } = await sb
      .from("shopping_items")
      .insert({ name, quantity: Math.min(99, quantity) })
      .select("id, name, quantity, added_by, done_at")
      .single()
      .overrideTypes<ShoppingRow, { merge: false }>();
    if (error) return fail(message(error, "We couldn't add that. Try again."));
    return ok(toShoppingItem(data));
  }

  async setShoppingItemDone({ id, done }: { id: string; done: boolean }): Promise<MutationResult> {
    const sb = await createClient();
    const { data, error } = await sb
      .from("shopping_items")
      .update({ done_at: done ? new Date().toISOString() : null })
      .eq("id", id)
      .select("id");
    if (error) return notSaved(message(error, TRY_AGAIN));
    return data.length ? saved : notSaved("That item was removed.");
  }

  async clearDoneShoppingItems(): Promise<MutationResult> {
    const sb = await createClient();
    const { error } = await sb.from("shopping_items").delete().not("done_at", "is", null);
    return error ? notSaved(message(error, "We couldn't clear the basket. Try again.")) : saved;
  }

  // ---- Chores -------------------------------------------------------------------

  async getChores(): Promise<DataResult<Chore[]>> {
    const sb = await createClient();
    const { data, error } = await sb
      .from("chores")
      .select(CHORE_SELECT)
      .order("created_at", { ascending: false })
      .overrideTypes<ChoreRow[], { merge: false }>();
    if (error) return fail(message(error, "We couldn't load the chores."));
    return ok(data.map(toChore));
  }

  async addChore({ title, due, repeat, assignees }: NewChore): Promise<DataResult<Chore>> {
    const sb = await createClient();
    const { data, error } = await sb
      .from("chores")
      .insert({ title, due, repeat })
      .select("id")
      .single()
      .overrideTypes<{ id: string }, { merge: false }>();
    if (error) return fail(message(error, "We couldn't add that chore. Try again."));

    const { error: assignError } = await sb
      .from("chore_assignees")
      .insert(assignees.map((profile_id) => ({ chore_id: data.id, profile_id })));
    if (assignError) {
      // don't leave a chore nobody's assigned to
      await sb.from("chores").delete().eq("id", data.id);
      return fail(message(assignError, "We couldn't assign that chore. Try again."));
    }
    return this.getChore(data.id);
  }

  async setChoreDone({ id, done }: { id: string; done: boolean }): Promise<DataResult<Chore>> {
    const sb = await createClient();
    // a recurring chore rolls on to its next due date (in the Together's time zone) instead of staying done
    const { error } = await sb.rpc("v1_set_chore_done", { p_chore_id: id, p_done: done });
    if (error) return fail(message(error, TRY_AGAIN));
    return this.getChore(id);
  }

  private async getChore(id: string): Promise<DataResult<Chore>> {
    const sb = await createClient();
    const { data, error } = await sb
      .from("chores")
      .select(CHORE_SELECT)
      .eq("id", id)
      .maybeSingle()
      .overrideTypes<ChoreRow | null, { merge: false }>();
    if (error) return fail(message(error, "We couldn't load that chore."));
    return data ? ok(toChore(data)) : fail("That chore was removed.");
  }

  // ---- Calendar -----------------------------------------------------------------

  async getEvents({ from, to }: { from: DayKey; to: DayKey }): Promise<DataResult<CalendarEvent[]>> {
    const sb = await createClient();
    const { data, error } = await sb
      .from("events")
      .select("id, title, day, start_time, location, event_attendees (profile_id)")
      .gte("day", from)
      .lte("day", to)
      .order("day")
      .order("start_time", { nullsFirst: true })
      .overrideTypes<EventRow[], { merge: false }>();
    if (error) return fail(message(error, "We couldn't load the calendar."));
    return ok(data.map(toEvent));
  }

  // ---- Places -------------------------------------------------------------------

  async getPlaces(): Promise<DataResult<Place[]>> {
    const sb = await createClient();
    const { data, error } = await sb
      .from("places")
      .select(PLACE_SELECT)
      .order("created_at", { ascending: false })
      .overrideTypes<PlaceRow[], { merge: false }>();
    if (error) return fail(message(error, "We couldn't load your places."));
    return ok(data.map(toPlace));
  }

  async getPlace({ id }: { id: string }): Promise<DataResult<Place>> {
    const sb = await createClient();
    const { data, error } = await sb
      .from("places")
      .select(PLACE_SELECT)
      .eq("id", id)
      .maybeSingle()
      .overrideTypes<PlaceRow | null, { merge: false }>();
    // 22P02: the id isn't a uuid, so there's no such place
    if (error && error.code !== "22P02") return fail(message(error, "We couldn't load that place."));
    return data ? ok(toPlace(data)) : fail("We couldn't find that place.");
  }

  async addPlace(place: NewPlace): Promise<DataResult<Place>> {
    const sb = await createClient();
    const hues: Hue[] = ["accent", "partner", "success", "warning"];
    const { count } = await sb.from("places").select("id", { count: "exact", head: true });
    const { data, error } = await sb
      .from("places")
      .insert({
        name: place.name,
        category: place.category ?? "Saved place",
        area: place.area || (place.mapsUrl ? "From Google Maps" : "Added by hand"),
        street: place.street,
        city: place.city,
        province: place.province,
        country: place.country,
        maps_url: place.mapsUrl,
        status: place.status,
        hue: hues[(count ?? 0) % hues.length],
        google_place_id: place.googlePlaceId,
        lat: place.location?.lat ?? null,
        lng: place.location?.lng ?? null,
        location_fetched_at: place.location ? new Date().toISOString() : null,
      })
      .select(PLACE_SELECT)
      .single()
      .overrideTypes<PlaceRow, { merge: false }>();
    // 23505: this Google place is already saved in this Together, so hand back that one
    if (error?.code === "23505" && place.googlePlaceId) {
      const existing = await sb
        .from("places")
        .select(PLACE_SELECT)
        .eq("google_place_id", place.googlePlaceId)
        .maybeSingle()
        .overrideTypes<PlaceRow | null, { merge: false }>();
      if (existing.data) return ok(toPlace(existing.data));
    }
    if (error) return fail(message(error, "We couldn't save that place. Try again."));
    return ok(toPlace(data));
  }

  async setPlaceLocation({ id, location }: { id: string; location: Coordinates }): Promise<MutationResult> {
    const sb = await createClient();
    const { error } = await sb
      .from("places")
      .update({ lat: location.lat, lng: location.lng, location_fetched_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return notSaved(message(error, "We couldn't update that place."));
    return saved;
  }

  async findPlaceFromLink(query: PlaceQuery): Promise<string | null> {
    return findPlaceId(query);
  }

  async getGooglePlace(params: { placeId: string; extras: boolean; sessionToken?: string }): Promise<GooglePlaceDetails | null> {
    return getGooglePlaceDetails(params.placeId, params);
  }

  // ---- Wishlist -----------------------------------------------------------------

  async getWishes({ ownerId }: { ownerId: MemberId }): Promise<DataResult<WishItem[]>> {
    const sb = await createClient();
    // row-level security hides claims on your own wishes, so the owner gets claimedBy null from the database itself
    const { data, error } = await sb
      .from("wishes")
      .select("id, owner_id, name, price_cents, url, hue, wish_claims (claimed_by)")
      .eq("owner_id", ownerId)
      .order("created_at")
      .overrideTypes<WishRow[], { merge: false }>();
    if (error) return fail(message(error, "We couldn't load the wishlist."));
    return ok(data.map(toWish));
  }

  async getGoals(): Promise<DataResult<Goal[]>> {
    const sb = await createClient();
    const { data, error } = await sb
      .from("goals")
      .select("id, title, saved_cents, target_cents, goal_owners (profile_id)")
      .order("created_at")
      .overrideTypes<GoalRow[], { merge: false }>();
    if (error) return fail(message(error, "We couldn't load your goals."));
    return ok(data.map(toGoal));
  }

  async setWishClaimed({ id, claimed }: { id: string; claimed: boolean }): Promise<MutationResult> {
    const sb = await createClient();
    const meId = await currentUserId(sb);
    if (!meId) return notSaved(SIGNED_OUT);

    if (!claimed) {
      const { error } = await sb.from("wish_claims").delete().eq("wish_id", id).eq("claimed_by", meId);
      return error ? notSaved(message(error, TRY_AGAIN)) : saved;
    }

    const { error } = await sb.from("wish_claims").insert({ wish_id: id });
    if (!error) return saved;
    switch (error.code) {
      case "23505": {
        // one claim per wish: fine if it's already yours
        const { data } = await sb
          .from("wish_claims")
          .select("claimed_by")
          .eq("wish_id", id)
          .maybeSingle()
          .overrideTypes<ClaimRow | null, { merge: false }>();
        return data?.claimed_by === meId ? saved : notSaved("Someone already claimed it.");
      }
      case "42501": // row-level security: it's your own wish
        return notSaved("You can't claim your own wish.");
      case "23503": // the wish is gone
      case "22P02":
        return notSaved("That wish was removed.");
      default:
        return notSaved(message(error, TRY_AGAIN));
    }
  }
}
