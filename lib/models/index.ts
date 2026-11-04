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
  /** the place's rating on Google Maps, 1–5, when it was matched on Google */
  googleRating: number | null;
  /** a photo of the place (our /api/places/<id>/photo route), when Google has one */
  photoUrl: string | null;
}

export interface NewPlace {
  name: string;
  /** the street and suburb or city, read from the Maps link; null when we don't know it */
  area: string | null;
  /** "Shopping mall", "Coffee shop"… from Google; null for "Saved place" */
  category: string | null;
  mapsUrl: string | null;
  status: PlaceStatus;
  /** what matched on Google Places, or null when we didn't look it up or found nothing */
  google: GooglePlaceRef | null;
}

export interface GooglePlaceRef {
  placeId: string;
  rating: number | null;
  /** the Places API resource name of its first photo, "places/<id>/photos/<ref>" */
  photo: string | null;
}

/** what to look up on Google Places: a name (with the area when known), near the pin when the link had one */
export interface PlaceQuery {
  text: string;
  near: { lat: number; lng: number } | null;
}

/** the best match on Google Places for a PlaceQuery */
export interface PlaceMatch extends GooglePlaceRef {
  name: string;
  category: string | null;
  area: string | null;
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
