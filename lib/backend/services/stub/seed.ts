import { addDays, todayKey } from "@/lib/format";
import type { CalendarEvent, CatalogEntry, Chore, Goal, Member, Place, ShoppingItem, Together, WishItem } from "@/lib/models";

// Seed data for the stub backend. Dates are relative to today so the app always looks lived-in.

export const BRANDON: Member = { id: "m-brandon", name: "Brandon", initial: "B", tone: "accent" };
export const ADELE: Member = { id: "m-adele", name: "Adele", initial: "A", tone: "partner" };

export interface StubState {
  together: Together | null;
  shopping: ShoppingItem[];
  catalog: CatalogEntry[];
  chores: Chore[];
  events: CalendarEvent[];
  places: Place[];
  wishes: WishItem[];
  goals: Goal[];
  nextId: number;
}

type SeedPlace = Omit<Place, "street" | "city" | "province" | "country" | "googlePlaceId" | "location"> &
  Partial<Pick<Place, "street" | "city" | "province" | "country" | "googlePlaceId">> & { at?: [number, number] };

/** seed places are in Cape Town unless they say otherwise; Nobu is linked to the stub's canned Google place */
const inCapeTown = (places: SeedPlace[]): Place[] =>
  places.map(({ at, ...p }) => ({
    street: "",
    city: "Cape Town",
    province: "Western Cape",
    country: "South Africa",
    googlePlaceId: null,
    ...p,
    location: at ? { lat: at[0], lng: at[1], fetchedAt: new Date().toISOString() } : null,
  }));

export function seed(today = todayKey()): StubState {
  const d = (days: number) => addDays(today, days);
  return {
    together: {
      id: "t-1",
      name: "Brandon & Adele",
      members: [BRANDON, ADELE],
      meId: BRANDON.id,
      inviteCode: "K7Q29X",
    },
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
      { id: "e-1", title: "Dinner at Nobu", day: d(0), time: "19:30", location: "Sea Point", attendees: [BRANDON.id, ADELE.id] },
      { id: "e-2", title: "Pilates", day: d(2), time: "07:00", location: "Gardens", attendees: [ADELE.id] },
      { id: "e-3", title: "Padel with Sam", day: d(5), time: "18:00", location: null, attendees: [BRANDON.id] },
      { id: "e-4", title: "Mom's birthday lunch", day: d(9), time: "12:30", location: "Constantia", attendees: [BRANDON.id, ADELE.id] },
      { id: "e-5", title: "Book club", day: d(11), time: "19:00", location: null, attendees: [ADELE.id] },
      { id: "e-6", title: "Weekend away", day: d(18), time: null, location: "Paternoster", attendees: [BRANDON.id, ADELE.id] },
      { id: "e-7", title: "Dentist", day: d(24), time: "09:15", location: null, attendees: [BRANDON.id] },
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
      { id: "p-5", name: "Kloof Street House", category: "Restaurant", area: "Gardens", status: "want", hue: "accent", mapsUrl: null, ratings: {}, visits: [] },
      { id: "p-6", name: "Paternoster beach walk", category: "Day trip", area: "West Coast", city: "Paternoster", status: "want", hue: "partner", mapsUrl: null, ratings: {}, visits: [] },
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
    nextId: 100,
  };
}
