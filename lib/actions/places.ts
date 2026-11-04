"use server";

import { serverBackend } from "@/lib/backend/server";
import type { DataResult, GooglePlaceDetails, NewPlace, Place, PlaceStatus } from "@/lib/models";
import { kindFromGoogleType } from "@/lib/places/google-types";
import { isMapsUrl, isShortMapsLink, placeFromMapsUrl, readPlaceInput, UNNAMED_PLACE } from "@/lib/places/maps-link";

export async function getPlaces() {
  return serverBackend.getPlaces();
}

export async function getPlace(id: string) {
  return serverBackend.getPlace({ id });
}

/** Google lets us keep a place's coordinates for 30 days */
const LOCATION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * A place with its Google details fetched fresh (rating, hours, photo, street; Google's terms say not to store them).
 * `google` is null for places added by hand, or when Google doesn't answer. Coordinates older than 30 days are
 * refreshed on the way.
 */
export async function getPlaceWithGoogle(id: string): Promise<DataResult<{ place: Place; google: GooglePlaceDetails | null }>> {
  const { data: place, error } = await serverBackend.getPlace({ id });
  if (!place) return { data: null, error };
  if (!place.googlePlaceId) return { data: { place, google: null } };

  const google = await serverBackend.getGooglePlace({ placeId: place.googlePlaceId, extras: true });
  const stale = !place.location || Date.now() - Date.parse(place.location.fetchedAt) > LOCATION_MAX_AGE_MS;
  if (google?.location && stale) await serverBackend.setPlaceLocation({ id, location: google.location });
  return { data: { place, google } };
}

/**
 * `input`: a Google Maps link, the text the Maps app shares, or just a name (saved as it is: it could be anything,
 * like "Mom's place").
 * A link is followed and read for a name and pin, matched on Google (Text Search, ids only), and saved with Google's
 * name, kind and our address labels (area, city, province, country) plus the place id and coordinates. When Google
 * has no match, it's saved with what the link says.
 */
export async function addPlace(input: string, status: PlaceStatus) {
  const parsed = readPlaceInput(input);
  if (!parsed) return { data: null, error: "Paste a Google Maps link or type the place's name." };
  if (parsed.kind === "name") return serverBackend.addPlace(byHand(parsed.name, status));

  const resolved = isShortMapsLink(parsed.url) ? ((await followMapsLink(parsed.url)) ?? parsed.url) : parsed.url;
  const { coordinates, ...details } = placeFromMapsUrl(resolved, parsed.url, parsed.label);
  // a dropped pin has no name to search for
  const placeId =
    details.name !== UNNAMED_PLACE
      ? await serverBackend.findPlaceFromLink({
          text: details.area ? `${details.name}, ${details.area}` : details.name,
          near: coordinates,
        })
      : null;
  const google = placeId ? await serverBackend.getGooglePlace({ placeId, extras: false }) : null;
  if (!google) return serverBackend.addPlace({ ...byHand(details.name, status), area: details.area ?? "", mapsUrl: details.mapsUrl });

  const { area, city, province, country } = google.address;
  return serverBackend.addPlace({
    name: google.name,
    category: kindFromGoogleType(google.primaryType),
    area,
    city,
    province,
    country,
    // a Google place's street is fetched fresh to show, not stored
    street: "",
    mapsUrl: details.mapsUrl,
    status,
    googlePlaceId: google.placeId,
    location: google.location,
  });
}

function byHand(name: string, status: PlaceStatus): NewPlace {
  return {
    name,
    category: null,
    area: "",
    street: "",
    city: "",
    province: "",
    country: "",
    mapsUrl: null,
    status,
    googlePlaceId: null,
    location: null,
  };
}

const MAX_REDIRECTS = 5;

/**
 * Follows a maps.app.goo.gl link to the full Google Maps link it stands for, which spells out the name and address.
 * Only ever requests Google Maps hosts, gives up after a few seconds, and returns null when it can't tell.
 */
async function followMapsLink(url: URL): Promise<URL | null> {
  let current = url;
  try {
    for (let hop = 0; hop < MAX_REDIRECTS; hop++) {
      const response = await fetch(current, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(4000) });
      const location = response.headers.get("location");
      if (response.status < 300 || response.status >= 400 || !location) return hop > 0 ? current : null;
      const next = new URL(location, current);
      // consent.google.com?continue=<the maps link> in some regions
      const continued = next.searchParams.get("continue");
      const target = next.hostname === "consent.google.com" && continued ? new URL(continued) : next;
      if (!isMapsUrl(target)) return null;
      current = target;
      if (!isShortMapsLink(current)) return current;
    }
  } catch (error) {
    console.error("[places] couldn't follow the maps link", error);
  }
  return null;
}
