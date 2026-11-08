import "server-only";
import { regionFor } from "@/lib/geocode/nominatim";
import type { PostgrestError } from "@supabase/supabase-js";
import type { ServerBackendService } from "@/lib/backend/interfaces/server";
import type {
  CalendarEvent,
  Challenge,
  ChallengeCadence,
  ChallengeOutcome,
  NewChallenge,
  CatalogEntry,
  Chore,
  ChoreRepeat,
  Coordinates,
  DataResult,
  DayKey,
  Goal,
  GooglePlaceDetails,
  Hue,
  InviteCode,
  InvitePreview,
  Member,
  MemberId,
  MemberRole,
  MemberTone,
  MutationResult,
  NewChore,
  NewEvent,
  NewGoal,
  NewPlace,
  NewWish,
  Place,
  PlaceQuery,
  PushSubscriptionKeys,
  PlaceStatus,
  NewVisit,
  PlaceChanges,
  PlaceSuggestion,
  ShoppingItem,
  Together,
  TogetherSummary,
  WishItem,
} from "@/lib/models";
import { PERIOD_NOUN, periodStartOf, summarize } from "@/lib/challenges/streak";
import { addDays, todayKey } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { autocomplete, findPlaceId, getPlace as getGooglePlaceDetails } from "@/lib/google/places";

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
  // many-to-one, so PostgREST embeds one row; a list is handled too, in case
  places: { id: string; name: string } | { id: string; name: string }[] | null;
}
interface PlaceRow {
  id: string;
  name: string;
  category: string;
  area: string;
  maps_url: string | null;
  note: string;
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

interface ChallengeRow {
  id: string;
  title: string;
  cadence: ChallengeCadence;
  starts_on: string;
  challenge_members: { profile_id: string }[];
  challenge_goals: { id: string; title: string; target: number; position: number; challenge_progress: { period_start: string; count: number }[] }[];
  challenge_periods: { period_start: string; outcome: ChallengeOutcome }[];
}

const TOGETHER_SELECT =
  "id, name, invite_code, invite_expires_at, together_members (profile_id, tone, role, joined_at, left_at, profiles (name))";
const CHORE_SELECT = "id, title, due, repeat, done_at, chore_assignees (profile_id)";
const EVENT_SELECT = "id, title, day, start_time, location, event_attendees (profile_id), places (id, name)";
const PLACE_SELECT =
  "id, name, category, area, street, city, province, country, maps_url, note, status, hue, google_place_id, lat, lng, location_fetched_at, place_ratings (profile_id, rating), visits (id, day, title, note, rating)";

const CHALLENGE_SELECT =
  "id, title, cadence, starts_on, challenge_members (profile_id), challenge_goals (id, title, target, position, challenge_progress (period_start, count)), challenge_periods (period_start, outcome)";
/** progress is only read for the current period, which starts at most a month back */
const PROGRESS_FROM = "challenge_goals.challenge_progress.period_start";

// ---- Mapping rows to models ---------------------------------------------------

function toMember(row: MemberRow): Member {
  const name = row.profiles?.name ?? "Someone";
  return { id: row.profile_id, name, initial: name.charAt(0).toUpperCase(), tone: row.tone, role: row.role };
}

const fromJson = (m: MemberJson) => ({ id: m.id, name: m.name, initial: m.name.charAt(0).toUpperCase(), tone: m.tone });

function toTogether(row: TogetherRow, meId: MemberId): Together {
  const byJoin = [...row.together_members].sort((a, b) => a.joined_at.localeCompare(b.joined_at));
  const members = byJoin.filter((m) => m.left_at === null).map(toMember);
  // a Together from before roles has no owner yet: the first member is (ensure_owner() in the schema makes it so)
  if (members.length && !members.some((m) => m.role === "owner")) members[0] = { ...members[0]!, role: "owner" };
  return {
    id: row.id,
    name: row.name,
    members,
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
  place: (Array.isArray(row.places) ? row.places[0] : row.places) ?? null,
});

const toPlace = (row: PlaceRow): Place => ({
  id: row.id,
  name: row.name,
  category: row.category,
  area: row.area,
  mapsUrl: row.maps_url,
  note: row.note,
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

function toChallenge(row: ChallengeRow, today: string): Challenge {
  const cadence = row.cadence;
  const periodStart = row.starts_on > today ? row.starts_on : periodStartOf(cadence, today);
  return {
    id: row.id,
    title: row.title,
    cadence,
    startsOn: row.starts_on,
    memberIds: row.challenge_members.map((m) => m.profile_id),
    goals: [...row.challenge_goals]
      .sort((a, b) => a.position - b.position)
      .map((g) => ({
        id: g.id,
        title: g.title,
        target: g.target,
        count: g.challenge_progress.find((p) => p.period_start === periodStart)?.count ?? 0,
      })),
    periodStart,
    periods: row.challenge_periods
      .map((p) => ({ start: p.period_start, outcome: p.outcome }))
      .sort((a, b) => b.start.localeCompare(a.start)),
  };
}

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

  async setMyName({ name }: { name: string }): Promise<MutationResult> {
    const sb = await createClient();
    const meId = await currentUserId(sb);
    if (!meId) return notSaved(SIGNED_OUT);
    const { error } = await sb.from("profiles").update({ name }).eq("id", meId);
    return error ? notSaved(message(error, "We couldn't change your name. Try again.")) : saved;
  }

  async savePushSubscription({ endpoint, p256dh, auth }: PushSubscriptionKeys): Promise<MutationResult> {
    const sb = await createClient();
    const { error } = await sb.rpc("v1_save_push_subscription", { p_endpoint: endpoint, p_p256dh: p256dh, p_auth: auth });
    return error ? notSaved(message(error, "We couldn't turn reminders on. Try again.")) : saved;
  }

  async deletePushSubscription({ endpoint }: { endpoint: string }): Promise<MutationResult> {
    const sb = await createClient();
    const { error } = await sb.from("push_subscriptions").delete().eq("endpoint", endpoint);
    return error ? notSaved(message(error, "We couldn't turn reminders off. Try again.")) : saved;
  }

  async joinTogether({ code }: { code: string }): Promise<DataResult<Together>> {
    const sb = await createClient();
    const { error } = await sb.rpc("v2_join_together", { p_code: code });
    if (error) return fail(message(error, "We couldn't join that Together. Try again."));
    return this.getTogether();
  }

  async getInvitePreview({ code }: { code: string }): Promise<DataResult<InvitePreview>> {
    const sb = await createClient();
    const result = await sb.rpc("v1_invite_preview", { p_code: code });
    const { error } = result;
    const data: unknown = result.data;
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
    const result = await sb.rpc("v1_list_my_togethers");
    const { error } = result;
    const data: unknown = result.data;
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
    const result = await sb.rpc("v1_new_invite_code");
    const { error } = result;
    const data: unknown = result.data;
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
    const result = await sb.rpc("v1_leave_together");
    const { error } = result;
    const data: unknown = result.data;
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

  async updateShoppingItem({ id, name, quantity }: { id: string; name: string; quantity: number }): Promise<DataResult<ShoppingItem>> {
    const sb = await createClient();
    const { data, error } = await sb
      .from("shopping_items")
      .update({ name, quantity: Math.min(99, quantity) })
      .eq("id", id)
      .select("id, name, quantity, added_by, done_at")
      .maybeSingle()
      .overrideTypes<ShoppingRow | null, { merge: false }>();
    if (error) return fail(message(error, "We couldn't save that item. Try again."));
    return data ? ok(toShoppingItem(data)) : fail("That item was removed.");
  }

  async deleteShoppingItem({ id }: { id: string }): Promise<MutationResult> {
    const sb = await createClient();
    const { error } = await sb.from("shopping_items").delete().eq("id", id);
    return error ? notSaved(message(error, "We couldn't remove that item. Try again.")) : saved;
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

  async updateChore({ id, title, due, repeat, assignees }: { id: string } & NewChore): Promise<DataResult<Chore>> {
    const sb = await createClient();
    const { data, error } = await sb.from("chores").update({ title, due, repeat }).eq("id", id).select("id");
    if (error) return fail(message(error, "We couldn't save that chore. Try again."));
    if (!data.length) return fail("That chore was removed.");

    // add the new people first, then take off the rest, so the chore is never left with nobody on it
    const add = await sb
      .from("chore_assignees")
      .upsert(
        assignees.map((profile_id) => ({ chore_id: id, profile_id })),
        { onConflict: "chore_id,profile_id", ignoreDuplicates: true }
      );
    if (add.error) return fail(message(add.error, "We couldn't change who it's for. Try again."));
    const drop = await sb.from("chore_assignees").delete().eq("chore_id", id).not("profile_id", "in", `(${assignees.join(",")})`);
    if (drop.error) return fail(message(drop.error, "We couldn't change who it's for. Try again."));
    return this.getChore(id);
  }

  async deleteChore({ id }: { id: string }): Promise<MutationResult> {
    const sb = await createClient();
    const { error } = await sb.from("chores").delete().eq("id", id);
    return error ? notSaved(message(error, "We couldn't delete that chore. Try again.")) : saved;
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
      .select(EVENT_SELECT)
      .gte("day", from)
      .lte("day", to)
      .order("day")
      .order("start_time", { nullsFirst: true })
      .overrideTypes<EventRow[], { merge: false }>();
    if (error) return fail(message(error, "We couldn't load the calendar."));
    return ok(data.map(toEvent));
  }

  async addEvent({ title, day, time, location, attendees, placeId }: NewEvent): Promise<DataResult<CalendarEvent>> {
    const sb = await createClient();
    const { data, error } = await sb
      .from("events")
      .insert({ title, day, start_time: time, location, place_id: placeId ?? null })
      .select("id")
      .single()
      .overrideTypes<{ id: string }, { merge: false }>();
    if (error) return fail(message(error, "We couldn't add that to the calendar. Try again."));

    if (attendees.length) {
      const { error: attendError } = await sb
        .from("event_attendees")
        .insert(attendees.map((profile_id) => ({ event_id: data.id, profile_id })));
      if (attendError) {
        await sb.from("events").delete().eq("id", data.id);
        return fail(message(attendError, "We couldn't add who's going. Try again."));
      }
    }
    const { data: row, error: readError } = await sb
      .from("events")
      .select(EVENT_SELECT)
      .eq("id", data.id)
      .single()
      .overrideTypes<EventRow, { merge: false }>();
    if (readError) return fail(message(readError, "We couldn't load that event."));
    return ok(toEvent(row));
  }

  async updateEvent({ id, title, day, time, location, attendees, placeId }: { id: string } & NewEvent): Promise<DataResult<CalendarEvent>> {
    const sb = await createClient();
    // left out, the plan keeps its place
    const place = placeId === undefined ? {} : { place_id: placeId };
    const { data, error } = await sb
      .from("events")
      .update({ title, day, start_time: time, location, ...place })
      .eq("id", id)
      .select("id");
    if (error) return fail(message(error, "We couldn't save that plan. Try again."));
    if (!data.length) return fail("That plan was removed.");

    if (attendees.length) {
      const add = await sb
        .from("event_attendees")
        .upsert(
          attendees.map((profile_id) => ({ event_id: id, profile_id })),
          { onConflict: "event_id,profile_id", ignoreDuplicates: true }
        );
      if (add.error) return fail(message(add.error, "We couldn't change who's going. Try again."));
    }
    const others = sb.from("event_attendees").delete().eq("event_id", id);
    const drop = attendees.length ? await others.not("profile_id", "in", `(${attendees.join(",")})`) : await others;
    if (drop.error) return fail(message(drop.error, "We couldn't change who's going. Try again."));

    const { data: row, error: readError } = await sb
      .from("events")
      .select(EVENT_SELECT)
      .eq("id", id)
      .single()
      .overrideTypes<EventRow, { merge: false }>();
    if (readError) return fail(message(readError, "We couldn't load that plan."));
    return ok(toEvent(row));
  }

  async deleteEvent({ id }: { id: string }): Promise<MutationResult> {
    const sb = await createClient();
    const { error } = await sb.from("events").delete().eq("id", id);
    return error ? notSaved(message(error, "We couldn't remove that. Try again.")) : saved;
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
        area: place.area,
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

  async getPlacePlans({ placeId, from }: { placeId: string; from: DayKey }): Promise<DataResult<CalendarEvent[]>> {
    const sb = await createClient();
    const { data, error } = await sb
      .from("events")
      .select(EVENT_SELECT)
      .eq("place_id", placeId)
      .gte("day", from)
      .order("day")
      .order("start_time", { nullsFirst: true })
      .overrideTypes<EventRow[], { merge: false }>();
    // 22P02: the id isn't a uuid, so it has no plans
    if (error?.code === "22P02") return ok([]);
    if (error) return fail(message(error, "We couldn't load the plans for this place."));
    return ok(data.map(toEvent));
  }

  async setPlaceNote({ id, note }: { id: string; note: string }): Promise<DataResult<Place>> {
    const sb = await createClient();
    const { data, error } = await sb
      .from("places")
      .update({ note })
      .eq("id", id)
      .select(PLACE_SELECT)
      .maybeSingle()
      .overrideTypes<PlaceRow | null, { merge: false }>();
    if (error) return fail(message(error, "We couldn't save that note. Try again."));
    return data ? ok(toPlace(data)) : fail("We couldn't find that place.");
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

  async updatePlace({ id, google, ...changes }: { id: string } & PlaceChanges): Promise<DataResult<Place>> {
    const sb = await createClient();
    const { data, error } = await sb
      .from("places")
      .update({
        ...changes,
        ...(google
          ? {
              google_place_id: google.placeId,
              lat: google.location?.lat ?? null,
              lng: google.location?.lng ?? null,
              location_fetched_at: google.location ? new Date().toISOString() : null,
              // a Google place's street is fetched fresh, not stored
              street: "",
            }
          : {}),
      })
      .eq("id", id)
      .select(PLACE_SELECT)
      .maybeSingle()
      .overrideTypes<PlaceRow | null, { merge: false }>();
    if (error?.code === "23505") return fail("That place is already in your list.");
    if (error) return fail(message(error, "We couldn't save your changes. Try again."));
    return data ? ok(toPlace(data)) : fail("We couldn't find that place.");
  }

  async unlinkPlace({ id }: { id: string }): Promise<MutationResult> {
    const sb = await createClient();
    const { error } = await sb
      .from("places")
      .update({ google_place_id: null, lat: null, lng: null, location_fetched_at: null })
      .eq("id", id);
    if (error) return notSaved(message(error, "We couldn't unlink that place."));
    return saved;
  }

  async deletePlace({ id }: { id: string }): Promise<MutationResult> {
    const sb = await createClient();
    const { error } = await sb.from("places").delete().eq("id", id);
    if (error) return notSaved(message(error, "We couldn't delete that place."));
    return saved;
  }

  async logVisit({ placeId, day, title, note, rating }: NewVisit): Promise<DataResult<Place>> {
    const sb = await createClient();
    // the insert trigger (mark_place_visited) moves the place to Been
    const visit = await sb.from("visits").insert({ place_id: placeId, day, title, note, rating });
    if (visit.error) return fail(message(visit.error, "We couldn't save that visit. Try again."));
    if (rating !== null) {
      const own = await sb
        .from("place_ratings")
        .upsert({ place_id: placeId, rating, updated_at: new Date().toISOString() }, { onConflict: "place_id,profile_id" });
      if (own.error) console.error("[supabase] visit saved, rating not", own.error.code, own.error.message);
    }
    return this.getPlace({ id: placeId });
  }

  async autocompletePlaces(params: { input: string; sessionToken: string; near: Coordinates | null }): Promise<PlaceSuggestion[]> {
    return autocomplete(params.input, params.sessionToken, params.near);
  }

  async findRegion({ queries }: { queries: string[] }) {
    return regionFor(queries);
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

  async addWish({ name, price, url }: NewWish): Promise<DataResult<WishItem>> {
    const sb = await createClient();
    const meId = await currentUserId(sb);
    if (!meId) return fail(SIGNED_OUT);
    const hues: Hue[] = ["accent", "partner", "success", "warning"];
    const { count } = await sb.from("wishes").select("id", { count: "exact", head: true }).eq("owner_id", meId);
    const { data, error } = await sb
      .from("wishes")
      .insert({ name, price_cents: price === null ? null : Math.round(price * 100), url, hue: hues[(count ?? 0) % hues.length] ?? "accent" })
      .select("id, owner_id, name, price_cents, url, hue, wish_claims (claimed_by)")
      .single()
      .overrideTypes<WishRow, { merge: false }>();
    if (error) return fail(message(error, "We couldn't add that wish. Try again."));
    return ok(toWish(data));
  }

  async deleteWish({ id }: { id: string }): Promise<MutationResult> {
    const sb = await createClient();
    const { error } = await sb.from("wishes").delete().eq("id", id);
    return error ? notSaved(message(error, "We couldn't remove that wish. Try again.")) : saved;
  }

  async addGoal({ title, target, ownerIds }: NewGoal): Promise<DataResult<Goal>> {
    const sb = await createClient();
    const { data, error } = await sb
      .from("goals")
      .insert({ title, target_cents: Math.round(target * 100) })
      .select("id")
      .single()
      .overrideTypes<{ id: string }, { merge: false }>();
    if (error) return fail(message(error, "We couldn't add that goal. Try again."));
    const { error: ownerError } = await sb
      .from("goal_owners")
      .insert(ownerIds.map((profile_id) => ({ goal_id: data.id, profile_id })));
    if (ownerError) {
      await sb.from("goals").delete().eq("id", data.id);
      return fail(message(ownerError, "We couldn't add that goal. Try again."));
    }
    return this.getGoal(data.id);
  }

  async setGoalSaved({ id, saved: amount }: { id: string; saved: number }): Promise<DataResult<Goal>> {
    const sb = await createClient();
    const { error } = await sb.from("goals").update({ saved_cents: Math.round(amount * 100) }).eq("id", id);
    if (error) return fail(message(error, "We couldn't save that. Try again."));
    return this.getGoal(id);
  }

  private async getGoal(id: string): Promise<DataResult<Goal>> {
    const sb = await createClient();
    const { data, error } = await sb
      .from("goals")
      .select("id, title, saved_cents, target_cents, goal_owners (profile_id)")
      .eq("id", id)
      .maybeSingle()
      .overrideTypes<GoalRow | null, { merge: false }>();
    if (error) return fail(message(error, "We couldn't load that goal."));
    return data ? ok(toGoal(data)) : fail("That goal was removed.");
  }

  // ---- Challenges ---------------------------------------------------------------

  async getChallenges(): Promise<DataResult<Challenge[]>> {
    const sb = await createClient();
    const today = todayKey();
    const { data, error } = await sb
      .from("challenges")
      .select(CHALLENGE_SELECT)
      .gte(PROGRESS_FROM, addDays(today, -31))
      .order("created_at", { ascending: false })
      .overrideTypes<ChallengeRow[], { merge: false }>();
    if (error) return fail(message(error, "We couldn't load your challenges."));
    return ok(data.map((row) => toChallenge(row, today)));
  }

  async getChallenge({ id }: { id: string }): Promise<DataResult<Challenge>> {
    const sb = await createClient();
    const today = todayKey();
    const { data, error } = await sb
      .from("challenges")
      .select(CHALLENGE_SELECT)
      .eq("id", id)
      .gte(PROGRESS_FROM, addDays(today, -31))
      .maybeSingle()
      .overrideTypes<ChallengeRow | null, { merge: false }>();
    if (error) return fail(message(error, "We couldn't load that challenge."));
    return data ? ok(toChallenge(data, today)) : fail("That challenge was removed.");
  }

  async addChallenge({ title, cadence, startsOn, memberIds, goals }: NewChallenge): Promise<DataResult<Challenge>> {
    const sb = await createClient();
    const result = await sb.rpc("v1_create_challenge", {
      p_title: title,
      p_cadence: cadence,
      p_starts_on: startsOn,
      p_member_ids: memberIds,
      p_goals: goals,
    });
    const { error } = result;
    const id: unknown = result.data;
    if (error) return fail(message(error, "We couldn't start that challenge. Try again."));
    return typeof id === "string" ? this.getChallenge({ id }) : fail(TRY_AGAIN);
  }

  async setChallengeGoalCount({ goalId, count }: { goalId: string; count: number }): Promise<DataResult<Challenge>> {
    const sb = await createClient();
    const { error } = await sb.rpc("v1_set_challenge_goal_count", { p_goal_id: goalId, p_count: count });
    if (error) return fail(message(error, "We couldn't save that. Try again."));
    const { data } = await sb
      .from("challenge_goals")
      .select("challenge_id")
      .eq("id", goalId)
      .maybeSingle()
      .overrideTypes<{ challenge_id: string } | null, { merge: false }>();
    return data ? this.getChallenge({ id: data.challenge_id }) : fail("That goal was removed.");
  }

  async settleMissedPeriod({ id, useBooster }: { id: string; useBooster: boolean }): Promise<DataResult<Challenge>> {
    const challenge = await this.getChallenge({ id });
    if (!challenge.data) return challenge;
    // boosters are worked out from the history, so check there's one before spending it
    const summary = summarize(challenge.data, todayKey());
    if (!summary.atRisk) return fail(`There's no missed ${PERIOD_NOUN[challenge.data.cadence]} to save.`);
    if (useBooster && summary.boosters < 1) return fail("There are no boosters left.");
    const sb = await createClient();
    const { error } = await sb
      .from("challenge_periods")
      .insert({ challenge_id: id, period_start: summary.atRisk.start, outcome: useBooster ? "boosted" : "reset" });
    if (error) return fail(message(error, "We couldn't save that. Try again."));
    return this.getChallenge({ id });
  }

  async deleteChallenge({ id }: { id: string }): Promise<MutationResult> {
    const sb = await createClient();
    const { error } = await sb.from("challenges").delete().eq("id", id);
    return error ? notSaved(message(error, "We couldn't delete that challenge. Try again.")) : saved;
  }
}
