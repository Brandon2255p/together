// Models: the domain types shared by every layer. No logic and no IO here.

export type MemberId = string;

/** Each member has a colour the whole app uses for them (dots, avatars, ratings), given in join order */
export type MemberTone = "accent" | "partner" | "success" | "warning";

/** owners make invite codes, remove people and make others owners */
export type MemberRole = "owner" | "member";

export interface Member {
  id: MemberId;
  name: string;
  initial: string;
  tone: MemberTone;
  role: MemberRole;
}

/** A circle of people sharing lists, a calendar, places and wishes. A person can be in many; one is current. */
export interface Together {
  id: string;
  name: string;
  /** everyone in it now, in join order */
  members: Member[];
  /** people who left or were removed: what they added stays, so their names are still needed */
  formerMembers: Member[];
  /** the signed-in member */
  meId: MemberId;
  inviteCode: string;
  /** ISO time the invite code stops working */
  inviteExpiresAt: string;
}

/** One of your Togethers, for the switcher (Home pill and /togethers) */
export interface TogetherSummary {
  id: string;
  name: string;
  memberCount: number;
  members: Pick<Member, "id" | "name" | "initial" | "tone">[];
  /** your tone and role in it */
  tone: MemberTone;
  role: MemberRole;
  current: boolean;
  /** ISO time of the newest thing anyone added or did there */
  lastActivityAt: string;
  /** someone else did something there since you last opened it */
  hasNews: boolean;
}

export interface InviteCode {
  code: string;
  /** ISO time */
  expiresAt: string;
}

/** what an invite code opens, before joining (/join/CODE) */
export interface InvitePreview {
  togetherId: string;
  name: string;
  members: Pick<Member, "id" | "name" | "initial" | "tone">[];
  expired: boolean;
  alreadyMember: boolean;
}

/** a calendar day, YYYY-MM-DD in the Together's time zone */
export type DayKey = string;

// ---- Lists ----------------------------------------------------------------

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  addedBy: MemberId;
  done: boolean;
}

/** what the shopping autocomplete knows about an item name */
export interface CatalogEntry {
  name: string;
  /** times this Together has added it */
  timesAdded: number;
  /** among the most-added items across everyone */
  popular: boolean;
}

export type ItemSuggestionReason = "usual" | "popular" | null;

export interface ItemSuggestion {
  name: string;
  reason: ItemSuggestionReason;
}

export type ChoreRepeat = "once" | "daily" | "weekly" | "monthly";

export interface Chore {
  id: string;
  title: string;
  due: DayKey | null;
  repeat: ChoreRepeat;
  /** one member, or several for a shared chore */
  assignees: MemberId[];
  done: boolean;
}

export type NewChore = Pick<Chore, "title" | "due" | "repeat" | "assignees">;

// ---- Calendar -------------------------------------------------------------

export interface CalendarEvent {
  id: string;
  title: string;
  day: DayKey;
  /** HH:mm, or null for all day */
  time: string | null;
  location: string | null;
  attendees: MemberId[];
}

export type NewEvent = Omit<CalendarEvent, "id">;

// ---- Places ---------------------------------------------------------------

export type PlaceStatus = "been" | "want";

/** the colour a place or wish uses for its thumbnail */
export type Hue = "accent" | "partner" | "success" | "warning";

export interface Visit {
  id: string;
  day: DayKey;
  title: string;
  note: string | null;
  rating: number | null;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Place {
  id: string;
  name: string;
  /** the kind: Restaurant, Café, Bar, Bakery, Hike, Other… */
  category: string;
  /** suburb or neighbourhood */
  area: string;
  /** only for places added by hand; a Google place's street is fetched fresh (GooglePlaceDetails) */
  street: string;
  city: string;
  province: string;
  country: string;
  mapsUrl: string | null;
  status: PlaceStatus;
  /** each member rates on their own, 1–5 */
  ratings: Partial<Record<MemberId, number>>;
  visits: Visit[];
  hue: Hue;
  /** set when the place was matched on Google; its details are fetched fresh, never stored */
  googlePlaceId: string | null;
  /** from Google, kept at most 30 days (Google's terms); `fetchedAt` is an ISO time */
  location: (Coordinates & { fetchedAt: string }) | null;
}

export interface NewPlace {
  name: string;
  category: string | null;
  /** area, street, city, province, country: "" when unknown */
  area: string;
  street: string;
  city: string;
  province: string;
  country: string;
  mapsUrl: string | null;
  status: PlaceStatus;
  googlePlaceId: string | null;
  location: Coordinates | null;
}

/** what to look up on Google Places: a name (with the area when known), near the pin when the link had one */
export interface PlaceQuery {
  text: string;
  near: Coordinates | null;
}

/** where a place is, as Google words it, split into the fields we filter and group by */
export interface PlaceAddress {
  street: string;
  area: string;
  city: string;
  province: string;
  country: string;
}

/**
 * A Google place, fetched fresh to show (never stored, per Google's terms).
 * The extras (rating, hours, photo) are only filled when asked for: they cost more.
 */
export interface GooglePlaceDetails {
  placeId: string;
  name: string;
  /** Google's primary type, e.g. "japanese_restaurant" */
  primaryType: string | null;
  formattedAddress: string | null;
  address: PlaceAddress;
  location: Coordinates | null;
  googleMapsUri: string | null;
  rating: number | null;
  ratingCount: number | null;
  /** null when Google doesn't know the hours */
  openNow: boolean | null;
  /** "22:00" in the place's own time, when it's open now and closes today */
  closesAt: string | null;
  /** a key-free image URL with the photographer's credit, which must be shown with it */
  photo: { url: string; credit: string | null; creditUrl: string | null } | null;
}

// ---- Wishlist -------------------------------------------------------------

export interface WishItem {
  id: string;
  ownerId: MemberId;
  name: string;
  /** whole rands */
  price: number | null;
  url: string | null;
  /** who's buying it as a gift. Never sent to the owner. */
  claimedBy: MemberId | null;
  hue: Hue;
}

export interface Goal {
  id: string;
  title: string;
  saved: number;
  target: number;
  /** more than one member: a shared goal */
  ownerIds: MemberId[];
}

/** a wish you add for yourself */
export type NewWish = Pick<WishItem, "name" | "price" | "url">;

export type NewGoal = Pick<Goal, "title" | "target" | "ownerIds">;

// ---- Results --------------------------------------------------------------

/** A read from the backend: the data, or null and the error */
export interface DataResult<T> {
  data: T | null;
  error?: string;
}

/** A change made through the backend: whether it was saved, and the error when it wasn't */
export interface MutationResult {
  success: boolean;
  error?: string;
}
