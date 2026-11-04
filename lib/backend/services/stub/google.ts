import "server-only";
import type { GooglePlaceDetails, PlaceQuery, PlaceSuggestion } from "@/lib/models";

// Canned Google Places answers for the stub backend, so adding and showing places works offline and in CI.

/** a stand-in "photo": the real one comes from Google */
const PHOTO =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><defs><linearGradient id="g" x2="0" y2="1">` +
      `<stop offset="0" stop-color="#8fb8de"/><stop offset=".6" stop-color="#f3c9a5"/><stop offset="1" stop-color="#2f4858"/>` +
      `</linearGradient></defs><rect width="400" height="300" fill="url(#g)"/>` +
      `<path d="M0 230 L90 170 L150 205 L240 140 L330 190 L400 160 V300 H0Z" fill="#3d5a6c"/></svg>`,
  );

const capeTown = { city: "Cape Town", province: "Western Cape", country: "South Africa" };

const kloof = (placeId: string, name: string, street: string, extra: Partial<GooglePlaceDetails> = {}): GooglePlaceDetails => ({
  placeId,
  name,
  primaryType: "restaurant",
  formattedAddress: `${street}, Gardens, Cape Town, 8001, South Africa`,
  address: { street, area: "Gardens", ...capeTown },
  location: { lat: -33.9311, lng: 18.4108 },
  googleMapsUri: "https://maps.google.com/?cid=10",
  rating: 4.3,
  ratingCount: 250,
  openNow: true,
  closesAt: "21:00",
  photo: null,
  priceLevel: 2,
  ...extra,
});

const PLACES: GooglePlaceDetails[] = [
  kloof("stub-kloof-street-house", "Kloof Street House", "30 Kloof Street", {
    rating: 4.5,
    ratingCount: 4100,
    closesAt: "23:00",
    priceLevel: 3,
    photo: { url: PHOTO, credit: "Thandi M.", creditUrl: null },
  }),
  kloof("stub-kloof-street-cafe", "Kloof Street Café", "2 Kloof Street", { primaryType: "cafe", priceLevel: 1 }),
  kloof("stub-kloof-street-pharmacy", "Kloof Street Pharmacy", "88 Kloof Street", {
    primaryType: "pharmacy",
    address: { street: "88 Kloof Street", area: "Tamboerskloof", ...capeTown },
    formattedAddress: "88 Kloof St, Tamboerskloof, Cape Town, 8001, South Africa",
    priceLevel: null,
  }),
  kloof("stub-kloof-street", "Kloof Street", "Kloof Street", {
    primaryType: "route",
    formattedAddress: "Kloof St, Cape Town, South Africa",
    address: { street: "Kloof Street", area: "", ...capeTown },
    rating: null,
    ratingCount: null,
    openNow: null,
    closesAt: null,
    priceLevel: null,
  }),
  kloof("stub-truth-coffee", "Truth Coffee Roasting", "36 Buitenkant Street", {
    primaryType: "coffee_shop",
    address: { street: "36 Buitenkant Street", area: "CBD", ...capeTown },
    formattedAddress: "36 Buitenkant St, Cape Town City Centre, Cape Town, 8000, South Africa",
    location: { lat: -33.9278, lng: 18.4223 },
    rating: 4.6,
    priceLevel: 2,
  }),
  {
    placeId: "stub-nobu",
    name: "Nobu",
    primaryType: "japanese_restaurant",
    formattedAddress: "One&Only, Dock Rd, V&A Waterfront, Cape Town, 8001, South Africa",
    address: { street: "Dock Road", area: "V&A Waterfront", ...capeTown },
    location: { lat: -33.9075, lng: 18.4167 },
    googleMapsUri: "https://maps.google.com/?cid=1",
    rating: 4.6,
    ratingCount: 1210,
    openNow: true,
    closesAt: "22:00",
    photo: { url: PHOTO, credit: "Thandi M.", creditUrl: null },
    priceLevel: 4,
  },
  {
    placeId: "stub-zeitz",
    name: "Zeitz Museum of Contemporary Art Africa",
    primaryType: "art_museum",
    formattedAddress: "V&A Waterfront, Silo District, S Arm Rd, Cape Town, 8001, South Africa",
    address: { street: "S Arm Road", area: "V&A Waterfront", ...capeTown },
    location: { lat: -33.9083, lng: 18.4225 },
    googleMapsUri: "https://maps.google.com/?cid=2",
    rating: 4.4,
    ratingCount: 9000,
    openNow: false,
    closesAt: null,
    photo: null,
  },
  {
    placeId: "stub-woodlands",
    name: "Woodlands Boulevard Shopping Complex",
    primaryType: "shopping_mall",
    formattedAddress: "Cnr Garsfontein Rd & De Villebois Mareuil Dr, Pretorius Park, Pretoria, 0081, South Africa",
    address: { street: "De Villebois Mareuil Drive", area: "Pretorius Park", city: "Pretoria", province: "Gauteng", country: "South Africa" },
    location: { lat: -25.7863, lng: 28.3297 },
    googleMapsUri: "https://maps.google.com/?cid=3",
    rating: 4.4,
    ratingCount: 30000,
    openNow: true,
    closesAt: "21:00",
    photo: null,
  },
];

const words = (text: string) => text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/** the canned place whose name shares a word with the query, else a made-up one so any link works */
export function stubFindPlace(query: PlaceQuery): string {
  const asked = new Set(words(query.text.split(",")[0] ?? query.text));
  const match = PLACES.find((p) => words(p.name).some((w) => asked.has(w)));
  return match?.placeId ?? `stub-${[...asked].join("-") || "place"}`;
}

/** canned autocomplete: the places whose name contains what was typed, with the matched part marked */
export function stubAutocomplete(input: string): PlaceSuggestion[] {
  const typed = input.trim().toLowerCase();
  if (!typed) return [];
  return PLACES.flatMap((p) => {
    const start = p.name.toLowerCase().indexOf(typed);
    if (start < 0) return [];
    const road = p.primaryType === "route";
    const secondary = road
      ? `Road · ${p.address.city}, ${p.address.country}`
      : [p.address.street, p.address.area, p.address.city].filter(Boolean).join(", ");
    return [{ placeId: p.placeId, name: p.name, secondary, matches: [[start, start + typed.length] as [number, number]], road }];
  }).slice(0, 5);
}

export function stubGetPlace(placeId: string, extras: boolean): GooglePlaceDetails | null {
  const known = PLACES.find((p) => p.placeId === placeId);
  const place: GooglePlaceDetails = known ?? {
    placeId,
    name: placeId.replace(/^stub-/, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    primaryType: "restaurant",
    formattedAddress: "Bree St, Cape Town, South Africa",
    address: { street: "Bree Street", area: "City Centre", ...capeTown },
    location: { lat: -33.92, lng: 18.42 },
    googleMapsUri: null,
    rating: 4.2,
    ratingCount: 120,
    openNow: null,
    closesAt: null,
    photo: null,
    priceLevel: 2,
  };
  return extras ? place : { ...place, rating: null, ratingCount: null, openNow: null, closesAt: null, photo: null, priceLevel: null };
}
