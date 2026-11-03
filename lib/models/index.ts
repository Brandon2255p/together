// Models: the domain types shared by every layer. No logic and no IO here.

export type MemberId = string;

/** Each member has a colour the whole app uses for them (dots, avatars, ratings) */
export type MemberTone = "accent" | "partner";

export interface Member {
  id: MemberId;
  name: string;
  initial: string;
  tone: MemberTone;
}

/** A circle of people sharing lists, a calendar, places and wishes */
export interface Together {
  id: string;
  name: string;
  members: Member[];
  /** the signed-in member */
  meId: MemberId;
  inviteCode: string;
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

export interface Place {
  id: string;
  name: string;
  category: string;
  area: string;
  mapsUrl: string | null;
  status: PlaceStatus;
  /** each member rates on their own, 1–5 */
  ratings: Partial<Record<MemberId, number>>;
  visits: Visit[];
  hue: Hue;
}

export interface NewPlace {
  name: string;
  mapsUrl: string | null;
  status: PlaceStatus;
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
