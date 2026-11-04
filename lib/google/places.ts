import "server-only";
import type { GooglePlaceDetails, PlaceQuery } from "@/lib/models";
import { addressFromComponents, closingTime, type AddressComponent } from "@/lib/places/google-types";

/**
 * Google Places API (New), server only: the key never reaches the browser.
 * Needs GOOGLE_MAPS_API_KEY with the Places API (New) enabled, restricted to that API and the server's IP (a key
 * restricted to websites is refused, since server requests carry no referrer). Without a key, everything returns null.
 *
 * Google's terms: only the place id may be stored for good, and coordinates for 30 days. Everything else here is
 * fetched to show and kept at most a few minutes in memory.
 * https://developers.google.com/maps/documentation/places/web-service/op-overview
 */

const API = "https://places.googleapis.com/v1";
const TIMEOUT_MS = 4000;
/** how far around a link's pin a match may be, in metres */
const NEAR_RADIUS_M = 500;
/** a short in-memory cache, so reopening a place doesn't pay for Place Details again */
const CACHE_MS = 10 * 60 * 1000;

/** what saving a place needs (Place Details Essentials/Pro) */
const SAVE_FIELDS = ["id", "displayName", "formattedAddress", "addressComponents", "location", "primaryType", "googleMapsUri"];
/** what showing a place adds (Place Details Enterprise) */
const SHOW_FIELDS = [
  ...SAVE_FIELDS,
  "rating",
  "userRatingCount",
  "currentOpeningHours.openNow",
  "currentOpeningHours.nextCloseTime",
  "utcOffsetMinutes",
  "photos",
];

interface PlaceResponse {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  addressComponents?: AddressComponent[];
  location?: { latitude?: number; longitude?: number };
  primaryType?: string;
  googleMapsUri?: string;
  rating?: number;
  userRatingCount?: number;
  currentOpeningHours?: { openNow?: boolean; nextCloseTime?: string };
  utcOffsetMinutes?: number;
  photos?: { name?: string; authorAttributions?: { displayName?: string; uri?: string }[] }[];
}

const apiKey = () => process.env.GOOGLE_MAPS_API_KEY || null;
let warnedNoKey = false;

function key(): string | null {
  const value = apiKey();
  if (!value && !warnedNoKey) console.warn("[google] GOOGLE_MAPS_API_KEY isn't set: places are saved without Google");
  warnedNoKey = true;
  return value;
}

async function call<T>(path: string, init: RequestInit & { fields?: string }): Promise<T | null> {
  const apiKeyValue = key();
  if (!apiKeyValue) return null;
  try {
    const response = await fetch(`${API}/${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKeyValue,
        ...(init.fields ? { "X-Goog-FieldMask": init.fields } : {}),
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error("[google]", path.split("?")[0], response.status, await response.text());
      return null;
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error("[google]", path.split("?")[0], error);
    return null;
  }
}

/** Text Search (IDs Only, the cheapest tier): the id of the best match, biased to the link's pin when it had one */
export async function findPlaceId(query: PlaceQuery): Promise<string | null> {
  const near = query.near
    ? { locationBias: { circle: { center: { latitude: query.near.lat, longitude: query.near.lng }, radius: NEAR_RADIUS_M } } }
    : {};
  const result = await call<{ places?: { id?: string }[] }>("places:searchText", {
    method: "POST",
    fields: "places.id",
    body: JSON.stringify({ textQuery: query.text, pageSize: 1, ...near }),
  });
  return result?.places?.[0]?.id ?? null;
}

const cache = new Map<string, { at: number; value: GooglePlaceDetails }>();

/**
 * Place Details. `extras` adds the rating, today's hours and a photo (with its credit), for showing a place; saving
 * one doesn't need them. `sessionToken` ends an autocomplete session (the autocomplete calls are then free).
 */
export async function getPlace(
  placeId: string,
  { extras, sessionToken }: { extras: boolean; sessionToken?: string },
): Promise<GooglePlaceDetails | null> {
  const cacheKey = `${placeId}:${extras}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;

  const query = new URLSearchParams({ languageCode: "en", ...(sessionToken ? { sessionToken } : {}) });
  const place = await call<PlaceResponse>(`places/${encodeURIComponent(placeId)}?${query.toString()}`, {
    method: "GET",
    fields: (extras ? SHOW_FIELDS : SAVE_FIELDS).join(","),
  });
  if (!place?.id) return null;

  const photo = extras ? place.photos?.[0] : undefined;
  const photoUrl = photo?.name ? await photoUri(photo.name) : null;
  const credit = photo?.authorAttributions?.[0];
  const { latitude, longitude } = place.location ?? {};
  const value: GooglePlaceDetails = {
    placeId: place.id,
    name: (place.displayName?.text ?? "").slice(0, 120) || "Unnamed place",
    primaryType: place.primaryType ?? null,
    formattedAddress: place.formattedAddress ?? null,
    address: addressFromComponents(place.addressComponents),
    location: typeof latitude === "number" && typeof longitude === "number" ? { lat: latitude, lng: longitude } : null,
    googleMapsUri: place.googleMapsUri ?? null,
    rating: typeof place.rating === "number" && place.rating >= 1 ? Math.round(place.rating * 10) / 10 : null,
    ratingCount: place.userRatingCount ?? null,
    openNow: place.currentOpeningHours?.openNow ?? null,
    closesAt: place.currentOpeningHours?.openNow
      ? closingTime(place.currentOpeningHours.nextCloseTime, place.utcOffsetMinutes)
      : null,
    photo: photoUrl ? { url: photoUrl, credit: credit?.displayName ?? null, creditUrl: credit?.uri ?? null } : null,
  };
  cache.set(cacheKey, { at: Date.now(), value });
  return value;
}

/** Place Photos: a short-lived googleusercontent.com URL without our key in it */
async function photoUri(name: string, maxWidthPx = 1200): Promise<string | null> {
  if (!/^places\/[^/]+\/photos\/[^/]+$/.test(name)) return null;
  const result = await call<{ photoUri?: string }>(`${name}/media?maxWidthPx=${maxWidthPx}&skipHttpRedirect=true`, {
    method: "GET",
  });
  return result?.photoUri ?? null;
}
