import type {
  CalendarEvent,
  CatalogEntry,
  NewEvent,
  NewGoal,
  NewWish,
  PushSubscriptionKeys,
  Chore,
  DataResult,
  DayKey,
  Goal,
  MemberId,
  MutationResult,
  NewChore,
  NewPlace,
  Place,
  Coordinates,
  GooglePlaceDetails,
  PlaceQuery,
  NewVisit,
  PlaceChanges,
  PlaceSuggestion,
  ShoppingItem,
  Together,
  WishItem,
} from "@/lib/models";

/**
 * Everything the app reads and writes, on the server. Implemented by the stub (seed data in memory) and by Supabase.
 * Server actions in lib/actions are the only callers.
 */
export interface ServerBackendService {
  // Together
  /** the signed-in member's Together, or null data when they haven't made or joined one */
  getTogether(): Promise<DataResult<Together>>;
  createTogether(params: { name: string }): Promise<DataResult<Together>>;
  renameTogether(params: { name: string }): Promise<MutationResult>;
  joinTogether(params: { code: string }): Promise<DataResult<Together>>;

  // You
  /** renames the signed-in person everywhere they appear */
  setMyName(params: { name: string }): Promise<MutationResult>;
  /** remembers this device for chore reminders; a device that changes hands moves to whoever is signed in */
  savePushSubscription(params: PushSubscriptionKeys): Promise<MutationResult>;
  deletePushSubscription(params: { endpoint: string }): Promise<MutationResult>;

  // Shopping
  getShoppingItems(): Promise<DataResult<ShoppingItem[]>>;
  /** the names the autocomplete draws on: this Together's history plus everyone's popular items */
  getItemCatalog(): Promise<DataResult<CatalogEntry[]>>;
  addShoppingItem(params: { name: string; quantity: number }): Promise<DataResult<ShoppingItem>>;
  setShoppingItemDone(params: { id: string; done: boolean }): Promise<MutationResult>;
  /** removes every item in the basket */
  clearDoneShoppingItems(): Promise<MutationResult>;

  // Chores
  getChores(): Promise<DataResult<Chore[]>>;
  addChore(params: NewChore): Promise<DataResult<Chore>>;
  /** a recurring chore that's done moves on to its next due date instead */
  setChoreDone(params: { id: string; done: boolean }): Promise<DataResult<Chore>>;

  // Calendar
  /** events from `from` to `to`, both included */
  getEvents(params: { from: DayKey; to: DayKey }): Promise<DataResult<CalendarEvent[]>>;
  addEvent(params: NewEvent): Promise<DataResult<CalendarEvent>>;
  deleteEvent(params: { id: string }): Promise<MutationResult>;

  // Places
  getPlaces(): Promise<DataResult<Place[]>>;
  getPlace(params: { id: string }): Promise<DataResult<Place>>;
  /** saving a Google place that's already in this Together gives back the one that's there */
  addPlace(params: NewPlace): Promise<DataResult<Place>>;
  /** refreshes a Google place's coordinates (Google lets us keep them 30 days) */
  setPlaceLocation(params: { id: string; location: Coordinates }): Promise<MutationResult>;
  /** saves the Edit place screen; with `google` it becomes that Google place (one already saved here is refused) */
  updatePlace(params: { id: string } & PlaceChanges): Promise<DataResult<Place>>;
  /** forgets the Google place (and its coordinates): it becomes a place added by hand */
  unlinkPlace(params: { id: string }): Promise<MutationResult>;
  /** deletes a place with its visits and ratings, for everyone in the Together */
  deletePlace(params: { id: string }): Promise<MutationResult>;
  /** saves a visit (the place moves to Been) and, with a rating, sets the signed-in member's own rating */
  logVisit(params: NewVisit): Promise<DataResult<Place>>;

  // Google Places: best effort, null when there's no match, no API key, or Google doesn't answer
  /** Autocomplete while typing in Add a place; [] when Google doesn't answer. One `sessionToken` per add, ended by Details. */
  autocompletePlaces(params: { input: string; sessionToken: string; near: Coordinates | null }): Promise<PlaceSuggestion[]>;
  /** the Google place a pasted Maps link points at, from its name and pin */
  findPlaceFromLink(params: PlaceQuery): Promise<string | null>;
  /** fresh details to save or show (never stored); `extras` adds the rating, hours and photo */
  getGooglePlace(params: { placeId: string; extras: boolean; sessionToken?: string }): Promise<GooglePlaceDetails | null>;

  // Wishlist
  /** a member's wishes. Asking for your own never says who claimed what. */
  getWishes(params: { ownerId: MemberId }): Promise<DataResult<WishItem[]>>;
  getGoals(): Promise<DataResult<Goal[]>>;
  /** claim (or unclaim) someone else's wish as a gift you'll buy */
  setWishClaimed(params: { id: string; claimed: boolean }): Promise<MutationResult>;
  /** adds a wish to your own list */
  addWish(params: NewWish): Promise<DataResult<WishItem>>;
  /** removes one of your own wishes */
  deleteWish(params: { id: string }): Promise<MutationResult>;
  addGoal(params: NewGoal): Promise<DataResult<Goal>>;
  /** sets how much has been saved towards a goal */
  setGoalSaved(params: { id: string; saved: number }): Promise<DataResult<Goal>>;
}
