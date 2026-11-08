import { periodStartOf, previousPeriod } from "@/lib/challenges/streak";
import { addDays, todayKey } from "@/lib/format";
import type {
  CalendarEvent,
  Challenge,
  ChallengeCadence,
  ChallengeOutcome,
  DayKey,
  CatalogEntry,
  Chore,
  Goal,
  Member,
  Place,
  ShoppingItem,
  Together,
  WishItem,
} from "@/lib/models";

// Seed data for the stub backend. Dates are relative to today so the app always looks lived-in.

export const BRANDON: Member = { id: "m-brandon", name: "Brandon", initial: "B", tone: "accent", role: "owner" };
export const ADELE: Member = { id: "m-adele", name: "Adele", initial: "A", tone: "partner", role: "member" };

/** one Together's data. The stub keeps one per Together (StubWorld); the signed-in person is always Brandon. */
export interface StubState {
  together: Together | null;
  /** ISO time of the newest activity, and whether someone else did something since Brandon last opened it */
  lastActivityAt: string;
  hasNews: boolean;
  shopping: ShoppingItem[];
  catalog: CatalogEntry[];
  chores: Chore[];
  events: CalendarEvent[];
  places: Place[];
  wishes: WishItem[];
  goals: Goal[];
  challenges: StubChallenge[];
  /** devices that asked for reminders, and who's signed in on each */
  nextId: number;
}

/** a challenge as the stub keeps it: progress per goal per period, materialised for today when read */
export interface StubChallenge extends Omit<Challenge, "goals" | "periodStart"> {
  goals: { id: string; title: string; target: number }[];
  /** goal id → period start → count */
  progress: Record<string, Record<DayKey, number>>;
}

/**
 * A seed challenge: `history` is its ended periods, oldest first (null = missed), and `now` this period's counts by
 * goal. It starts `history.length` periods before the current one.
 */
function seedChallenge(
  today: DayKey,
  c: { id: string; title: string; cadence: ChallengeCadence; memberIds: string[]; goals: [string, number][]; history: (ChallengeOutcome | null)[]; now: number[] },
): StubChallenge {
  const current = periodStartOf(c.cadence, today);
  const starts: DayKey[] = [];
  let p = current;
  for (let i = 0; i < c.history.length; i++) starts.unshift((p = previousPeriod(c.cadence, p)));
  const goals = c.goals.map(([title, target], i) => ({ id: `${c.id}-g${i + 1}`, title, target }));
  return {
    id: c.id,
    title: c.title,
    cadence: c.cadence,
    startsOn: starts[0] ?? current,
    memberIds: c.memberIds,
    goals,
    progress: Object.fromEntries(goals.map((g, i) => [g.id, { [current]: c.now[i] ?? 0 }])),
    periods: c.history.flatMap((outcome, i) => (outcome ? [{ start: starts[i]!, outcome }] : [])).reverse(),
  };
}

const times = <T>(n: number, value: T): T[] => Array.from({ length: n }, () => value);

/** Brandon & Adele's challenges: a long daily streak, a weekly one with a booster used, one at risk, a monthly one */
function seedChallenges(today: DayKey): StubChallenge[] {
  return [
    seedChallenge(today, {
      id: "ch-1",
      title: "Move every day",
      cadence: "daily",
      memberIds: [BRANDON.id],
      goals: [["30 min walk or run", 1], ["Stretch", 1], ["Glasses of water", 8]],
      history: times(22, "done"),
      now: [1, 1, 5],
    }),
    seedChallenge(today, {
      id: "ch-2",
      title: "Gym together",
      cadence: "weekly",
      memberIds: [BRANDON.id, ADELE.id],
      goals: [["Go to the gym", 3], ["Meal prep on Sunday", 1], ["10k steps", 5]],
      history: [null, ...times(5, "done" as const), "boosted", ...times(6, "done" as const)],
      now: [2, 1, 3],
    }),
    seedChallenge(today, {
      id: "ch-3",
      title: "Read before bed",
      cadence: "daily",
      memberIds: [ADELE.id, BRANDON.id],
      goals: [["Read 20 pages", 1], ["Phone away by 10", 1]],
      // yesterday was missed: the streak is at risk, and there's a booster to save it with
      history: [...times(9, "done" as const), null],
      now: [1, 0],
    }),
    seedChallenge(today, {
      id: "ch-4",
      title: "Date night",
      cadence: "monthly",
      memberIds: [BRANDON.id, ADELE.id],
      goals: [["Go on a date", 2], ["Try somewhere new", 1]],
      history: times(5, "done"),
      now: [0, 0],
    }),
  ];
}

type SeedPlace = Omit<Place, "street" | "city" | "province" | "country" | "googlePlaceId" | "location" | "note"> &
  Partial<Pick<Place, "street" | "city" | "province" | "country" | "googlePlaceId" | "note">> & { at?: [number, number] };

/** seed places are in Cape Town unless they say otherwise; Nobu is linked to the stub's canned Google place */
const inCapeTown = (places: SeedPlace[]): Place[] =>
  places.map(({ at, ...p }) => ({
    street: "",
    city: "Cape Town",
    province: "Western Cape",
    country: "South Africa",
    googlePlaceId: null,
    note: "",
    ...p,
    location: at ? { lat: at[0], lng: at[1], fetchedAt: new Date().toISOString() } : null,
  }));

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

export function seed(today = todayKey()): StubState {
  const d = (days: number) => addDays(today, days);
  return {
    together: {
      id: "t-1",
      name: "Brandon & Adele",
      members: [BRANDON, ADELE],
      formerMembers: [],
      meId: BRANDON.id,
      inviteCode: "K7Q29X",
      inviteExpiresAt: hoursFromNow(41),
    },
    lastActivityAt: hoursFromNow(-0.5),
    hasNews: false,
    shopping: [
      { id: "s-1", name: "Oat milk", quantity: 2, addedBy: BRANDON.id, done: false },
      { id: "s-2", name: "Avocados", quantity: 3, addedBy: ADELE.id, done: false },
      { id: "s-3", name: "Coffee beans", quantity: 1, addedBy: BRANDON.id, done: false },
      { id: "s-4", name: "Dish soap", quantity: 1, addedBy: ADELE.id, done: false },
      { id: "s-5", name: "Sourdough loaf", quantity: 1, addedBy: BRANDON.id, done: false },
      { id: "s-6", name: "Eggs", quantity: 1, addedBy: ADELE.id, done: true },
    ],
    catalog: [
      ...[
        ["Milk", 12],
        ["Oat milk", 9],
        ["Eggs", 8],
        ["Bananas", 7],
        ["Coffee beans", 6],
        ["Sourdough loaf", 5],
        ["Avocados", 5],
        ["Mince", 3],
      ].map(([name, timesAdded]) => ({ name: name as string, timesAdded: timesAdded as number, popular: true })),
      ...[
        "Mint", "Mineral water", "Mushrooms", "Mozzarella", "Mango", "Butter", "Bread", "Broccoli", "Cheddar",
        "Chicken breasts", "Tomatoes", "Toilet paper", "Pasta", "Parmesan", "Peanut butter", "Rice", "Spinach",
        "Strawberries", "Yoghurt", "Washing powder", "Dish soap", "Olive oil", "Onions", "Garlic", "Lemons",
      ].map((name) => ({ name, timesAdded: 0, popular: ["Butter", "Bread", "Tomatoes", "Toilet paper", "Pasta", "Onions"].includes(name) })),
    ],
    chores: [
      { id: "c-1", title: "Get keys from tenant", due: d(0), repeat: "once", assignees: [BRANDON.id], done: false },
      { id: "c-2", title: "Water the plants", due: d(0), repeat: "weekly", assignees: [BRANDON.id, ADELE.id], done: false },
      { id: "c-3", title: "Pay electricity", due: d(4), repeat: "monthly", assignees: [ADELE.id], done: false },
      { id: "c-4", title: "Book car service", due: d(9), repeat: "once", assignees: [BRANDON.id], done: false },
      { id: "c-5", title: "Fix the wobbly chair", due: null, repeat: "once", assignees: [ADELE.id], done: false },
      { id: "c-6", title: "Take out the bins", due: null, repeat: "once", assignees: [BRANDON.id, ADELE.id], done: true },
    ],
    events: [
      { id: "e-1", title: "Dinner at Nobu", day: d(0), time: "19:30", location: "Sea Point", attendees: [BRANDON.id, ADELE.id], place: { id: "p-1", name: "Nobu" } },
      { id: "e-2", title: "Pilates", day: d(2), time: "07:00", location: "Gardens", attendees: [ADELE.id], place: null },
      { id: "e-3", title: "Padel with Sam", day: d(5), time: "18:00", location: null, attendees: [BRANDON.id], place: null },
      { id: "e-4", title: "Mom's birthday lunch", day: d(9), time: "12:30", location: "Constantia", attendees: [BRANDON.id, ADELE.id], place: null },
      { id: "e-5", title: "Book club", day: d(11), time: "19:00", location: null, attendees: [ADELE.id], place: null },
      { id: "e-6", title: "Weekend away", day: d(18), time: null, location: "Paternoster", attendees: [BRANDON.id, ADELE.id], place: { id: "p-6", name: "Paternoster beach walk" } },
      { id: "e-7", title: "Dentist", day: d(24), time: "09:15", location: null, attendees: [BRANDON.id], place: null },
    ],
    places: inCapeTown([
      {
        id: "p-1", name: "Nobu", category: "Japanese", area: "Sea Point", status: "been", hue: "accent",
        googlePlaceId: "stub-nobu", at: [-33.9075, 18.4167],
        mapsUrl: "https://www.google.com/maps/place/Nobu+Cape+Town",
        ratings: { [BRANDON.id]: 4.5, [ADELE.id]: 5 },
        visits: [
          { id: "v-1", day: d(-22), title: "Anniversary dinner", note: "“The black cod was unreal.” — Adele", rating: 5 },
          { id: "v-2", day: d(-93), title: "Sushi after the movies", note: "Sat at the bar, quick & great.", rating: 4.5 },
          { id: "v-3", day: d(-200), title: "First time", note: null, rating: 4.5 },
        ],
      },
      {
        id: "p-2", name: "Truth Coffee", category: "Café", area: "CBD", street: "36 Buitenkant St", status: "been", hue: "partner", mapsUrl: null,
        ratings: { [BRANDON.id]: 4.5, [ADELE.id]: 4.5 },
        visits: [{ id: "v-4", day: d(-3), title: "Saturday flat whites", note: null, rating: 4.5 }],
      },
      {
        id: "p-3", name: "Lion's Head sunrise", category: "Hike", area: "Tamboerskloof", street: "Signal Hill Rd", status: "been", hue: "success", mapsUrl: null,
        ratings: { [BRANDON.id]: 5, [ADELE.id]: 5 },
        visits: [{ id: "v-5", day: d(-40), title: "Full moon hike", note: "Bring headlamps next time.", rating: 5 }],
      },
      {
        id: "p-4", name: "La Petite Tarte", category: "Bakery", area: "De Waterkant", street: "4 Dixon St", status: "been", hue: "warning", mapsUrl: null,
        ratings: { [BRANDON.id]: 4, [ADELE.id]: 4.5 },
        visits: [{ id: "v-6", day: d(-12), title: "Brunch", note: null, rating: 4.2 }],
      },
      { id: "p-5", name: "Kloof Street House", category: "Restaurant", area: "Gardens", status: "want", hue: "accent", mapsUrl: null, ratings: {}, visits: [],
        note: "Sam says the burnt butter gnocchi is the best in town. Book the upstairs room." },
      { id: "p-6", name: "Paternoster beach walk", category: "Day trip", area: "West Coast", city: "Paternoster", status: "want", hue: "partner", mapsUrl: null, ratings: {}, visits: [],
        note: "Low tide is best. Lunch at Wolfgat after?" },
      { id: "p-7", name: "Zeitz MOCAA", category: "Museum", area: "Waterfront", status: "want", hue: "success", mapsUrl: null, ratings: {}, visits: [] },
      { id: "p-8", name: "Jason Bakery", category: "Bakery", area: "Bree Street", status: "want", hue: "warning", mapsUrl: null, ratings: {}, visits: [] },
      {
        id: "p-9", name: "Delaire Graff", category: "Restaurant", area: "Helshoogte Pass", city: "Stellenbosch", status: "been", hue: "partner",
        street: "R310 Helshoogte Rd", mapsUrl: null, at: [-33.9196, 18.9234],
        ratings: { [BRANDON.id]: 5, [ADELE.id]: 4 },
        visits: [{ id: "v-7", day: d(-60), title: "Long lunch", note: "Sit on the terrace.", rating: 5 }],
      },
      {
        id: "p-10", name: "Le Lude", category: "Bar", area: "", city: "Franschhoek", status: "want", hue: "success",
        street: "Lambrechts St", mapsUrl: null, ratings: {}, visits: [],
      },
      {
        id: "p-11", name: "Pastéis de Belém", category: "Bakery", area: "Belém", city: "Lisbon", province: "Lisbon", country: "Portugal",
        status: "want", hue: "accent", street: "R. de Belém 84", mapsUrl: null, ratings: {}, visits: [],
      },
    ]),
    wishes: [
      { id: "w-1", ownerId: BRANDON.id, name: "Pour-over set", price: 650, url: null, claimedBy: ADELE.id, hue: "accent" },
      { id: "w-2", ownerId: BRANDON.id, name: "Running shoes", price: 2100, url: null, claimedBy: null, hue: "partner" },
      { id: "w-3", ownerId: BRANDON.id, name: "Film camera", price: 3400, url: null, claimedBy: null, hue: "success" },
      { id: "w-4", ownerId: BRANDON.id, name: "Linen sheets", price: 1800, url: null, claimedBy: null, hue: "warning" },
      { id: "w-5", ownerId: ADELE.id, name: "Silk scarf", price: 890, url: "https://example.com", claimedBy: BRANDON.id, hue: "accent" },
      { id: "w-6", ownerId: ADELE.id, name: "Pottery class for two", price: 1200, url: "https://example.com", claimedBy: null, hue: "partner" },
      { id: "w-7", ownerId: ADELE.id, name: "Kindle Paperwhite", price: 3100, url: "https://example.com", claimedBy: null, hue: "success" },
      { id: "w-8", ownerId: ADELE.id, name: "Fresh flowers, monthly", price: 450, url: null, claimedBy: null, hue: "warning" },
    ],
    goals: [
      { id: "g-1", title: "Weekend in Paternoster", saved: 4200, target: 8000, ownerIds: [BRANDON.id, ADELE.id] },
      { id: "g-2", title: "New road bike", saved: 6500, target: 18000, ownerIds: [BRANDON.id] },
    ],
    challenges: seedChallenges(today),
    nextId: 100,
  };
}

// ---- More Togethers -----------------------------------------------------------------------------------------------

const member = (id: string, name: string, tone: Member["tone"], role: Member["role"] = "member"): Member => ({
  id,
  name,
  initial: name.charAt(0).toUpperCase(),
  tone,
  role,
});

/** an empty Together's data, for new ones and as the base of the extra seeds */
export function blankState(together: Together | null, nextId = 100): StubState {
  return {
    together,
    lastActivityAt: new Date().toISOString(),
    hasNews: false,
    shopping: [],
    catalog: [],
    chores: [],
    events: [],
    places: [],
    wishes: [],
    goals: [],
    challenges: [],
    nextId,
  };
}

/** Brandon's family: Linda owns it, Brandon joined second. Sam added something since Brandon last looked. */
function seedFamily(today: string): StubState {
  const d = (days: number) => addDays(today, days);
  const linda = member("m-linda", "Linda", "accent", "owner");
  const brandon = member(BRANDON.id, BRANDON.name, "partner");
  const sam = member("m-sam", "Sam", "success");
  return {
    ...blankState(
      {
        id: "t-2",
        name: "Family",
        members: [linda, brandon, sam],
        formerMembers: [],
        meId: BRANDON.id,
        inviteCode: "F4MXLY",
        inviteExpiresAt: hoursFromNow(12),
      },
      1000,
    ),
    lastActivityAt: hoursFromNow(-2),
    hasNews: true,
    shopping: [
      { id: "s-f1", name: "Braai wood", quantity: 2, addedBy: sam.id, done: false },
      { id: "s-f2", name: "Boerewors", quantity: 1, addedBy: linda.id, done: false },
    ],
    chores: [
      { id: "c-f1", title: "Book the Christmas venue", due: d(6), repeat: "once", assignees: [linda.id, brandon.id], done: false },
    ],
    events: [{ id: "e-f1", title: "Sunday lunch", day: d(3), time: "12:30", location: "Constantia", attendees: [linda.id, brandon.id, sam.id], place: null }],
    wishes: [{ id: "w-f1", ownerId: sam.id, name: "Cricket bat", price: 1400, url: null, claimedBy: null, hue: "success" }],
  };
}

/** a flat Brandon owns. Kyle moved out (left), but his wish stays. */
function seedFlat(today: string): StubState {
  const d = (days: number) => addDays(today, days);
  const brandon = member(BRANDON.id, BRANDON.name, "accent", "owner");
  const thandi = member("m-thandi", "Thandi", "partner");
  const jo = member("m-jo", "Jo", "success");
  const priya = member("m-priya", "Priya", "warning");
  const kyle = member("m-kyle", "Kyle", "accent");
  return {
    ...blankState(
      {
        id: "t-3",
        name: "Kloof St flat",
        members: [brandon, thandi, jo, priya],
        formerMembers: [kyle],
        meId: BRANDON.id,
        inviteCode: "KL7FST",
        inviteExpiresAt: hoursFromNow(-3),
      },
      2000,
    ),
    lastActivityAt: hoursFromNow(-24 * 9),
    shopping: [{ id: "s-k1", name: "Toilet paper", quantity: 2, addedBy: jo.id, done: false }],
    chores: [
      { id: "c-k1", title: "Take out the bins", due: d(1), repeat: "weekly", assignees: [thandi.id], done: false },
      { id: "c-k2", title: "Clean the fridge", due: d(5), repeat: "monthly", assignees: [brandon.id, priya.id], done: false },
    ],
    wishes: [{ id: "w-k1", ownerId: kyle.id, name: "Plant for the stoep", price: 300, url: null, claimedBy: null, hue: "accent" }],
  };
}

/** a Together Brandon isn't in, so joining with a code can be tried: PADL27 */
function seedPadel(): StubState {
  const sam = member("m-sam", "Sam", "accent", "owner");
  const lee = member("m-lee", "Lee", "partner");
  return {
    ...blankState(
      { id: "t-4", name: "Padel crew", members: [sam, lee], formerMembers: [], meId: BRANDON.id, inviteCode: "PADL27", inviteExpiresAt: hoursFromNow(30) },
      3000,
    ),
    lastActivityAt: hoursFromNow(-5),
    hasNews: true,
  };
}

/** a Together whose code has run out: XPRD99 */
function seedExpired(): StubState {
  const zee = member("m-zee", "Zee", "accent", "owner");
  return blankState(
    { id: "t-5", name: "Hiking club", members: [zee], formerMembers: [], meId: BRANDON.id, inviteCode: "XPRD99", inviteExpiresAt: hoursFromNow(-1) },
    4000,
  );
}

/** every Together the stub knows, and which one Brandon has open */
export interface StubWorld {
  currentId: string | null;
  togethers: Record<string, StubState>;
}

export function seedWorld(today = todayKey()): StubWorld {
  const all = [seed(today), seedFamily(today), seedFlat(today), seedPadel(), seedExpired()];
  return { currentId: "t-1", togethers: Object.fromEntries(all.map((s) => [s.together!.id, s])) };
}
