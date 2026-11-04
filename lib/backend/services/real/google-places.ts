import "server-only";
import type { PlaceMatch, PlaceQuery } from "@/lib/models";

/**
 * Google Places API (New): Text Search to match a saved place, Place Photos to show it.
 * Needs GOOGLE_MAPS_API_KEY (server only) with the Places API (New) enabled. Without it, lookups return null.
 * https://developers.google.com/maps/documentation/places/web-service/text-search
 */

const API = "https://places.googleapis.com/v1";
const TIMEOUT_MS = 4000;
/** how far around the link's pin a match may be, in metres */
const NEAR_RADIUS_M = 500;
const SEARCH_FIELDS = [
  "places.id",
  "places.displayName",
  "places.primaryTypeDisplayName",
  "places.shortFormattedAddress",
  "places.rating",
  "places.photos",
].join(",");

interface SearchResponse {
  places?: {
    id: string;
    displayName?: { text?: string };
    primaryTypeDisplayName?: { text?: string };
    shortFormattedAddress?: string;
    rating?: number;
    photos?: { name?: string }[];
  }[];
}

interface PhotoResponse {
  photoUri?: string;
}

const apiKey = () => process.env.GOOGLE_MAPS_API_KEY || null;
let warnedNoKey = false;

export async function searchPlace(query: PlaceQuery): Promise<PlaceMatch | null> {
  const key = apiKey();
  if (!key) {
    if (!warnedNoKey) console.warn("[places] GOOGLE_MAPS_API_KEY isn't set: saving places without Google details");
    warnedNoKey = true;
    return null;
  }
  try {
    const response = await fetch(`${API}/places:searchText`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": SEARCH_FIELDS },
      body: JSON.stringify({
        textQuery: query.text,
        pageSize: 1,
        languageCode: "en",
        ...(query.near
          ? {
              locationBias: {
                circle: { center: { latitude: query.near.lat, longitude: query.near.lng }, radius: NEAR_RADIUS_M },
              },
            }
          : {}),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error("[places] text search failed", response.status, await response.text());
      return null;
    }
    const place = ((await response.json()) as SearchResponse).places?.[0];
    if (!place?.id) return null;
    const photo = place.photos?.[0]?.name ?? null;
    return {
      placeId: place.id,
      name: (place.displayName?.text ?? query.text).slice(0, 120),
      category: place.primaryTypeDisplayName?.text?.slice(0, 40) ?? null,
      area: place.shortFormattedAddress ? fitArea(place.shortFormattedAddress) : null,
      rating: typeof place.rating === "number" && place.rating >= 1 ? Math.round(place.rating * 10) / 10 : null,
      photo: photo && /^places\/[^/]+\/photos\/[^/]+$/.test(photo) ? photo : null,
    };
  } catch (error) {
    console.error("[places] text search failed", error);
    return null;
  }
}

/** a short-lived googleusercontent.com URL for a photo resource name; the API key never reaches the browser */
export async function photoUrl(photo: string, maxWidthPx = 1200): Promise<string | null> {
  const key = apiKey();
  if (!key) return null;
  try {
    const url = `${API}/${photo}/media?maxWidthPx=${maxWidthPx}&skipHttpRedirect=true`;
    const response = await fetch(url, { headers: { "X-Goog-Api-Key": key }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) {
      console.error("[places] photo failed", response.status, await response.text());
      return null;
    }
    return ((await response.json()) as PhotoResponse).photoUri ?? null;
  } catch (error) {
    console.error("[places] photo failed", error);
    return null;
  }
}

/** places.area is at most 60 characters: drop leading parts of the address (the street) until it fits */
function fitArea(address: string): string {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  while (parts.length > 1 && parts.join(", ").length > 60) parts.shift();
  return parts.join(", ").slice(0, 60);
}
