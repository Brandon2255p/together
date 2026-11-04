"use server";

import { serverBackend } from "@/lib/backend/server";
import type {
  Coordinates,
  DataResult,
  GooglePlaceDetails,
  MutationResult,
  NewVisit,
  Place,
  PlaceStatus,
  PlaceSuggestion,
} from "@/lib/models";
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

const SESSION_TOKEN = /^[A-Za-z0-9-]{8,64}$/;
const GOOGLE_ID = /^[A-Za-z0-9_-]{1,300}$/;
const MAX_QUERY = 120;

/** Autocomplete for Add a place (21a). Empty for a blank query or a bad token; Google errors come back as []. */
export async function autocompletePlaces(input: string, sessionToken: string, near: Coordinates | null): Promise<PlaceSuggestion[]> {
  const text = input.trim().slice(0, MAX_QUERY);
  if (text.length < 2 || !SESSION_TOKEN.test(sessionToken)) return [];
  return serverBackend.autocompletePlaces({ input: text, sessionToken, near: validCoordinates(near) });
}

/** The preview (21b): fresh details with rating, price, hours and photo. Ends the autocomplete session. */
export async function previewGooglePlace(placeId: string, sessionToken: string | null): Promise<DataResult<GooglePlaceDetails>> {
  if (!GOOGLE_ID.test(placeId)) return { data: null, error: "We couldn't find that place on Google." };
  const token = sessionToken && SESSION_TOKEN.test(sessionToken) ? sessionToken : undefined;
  const google = await serverBackend.getGooglePlace({ placeId, extras: true, sessionToken: token });
  return google ? { data: google } : { data: null, error: "Google didn't answer. Try again, or add it by hand." };
}

/**
 * A pasted Google Maps link (or the text the Maps app shares): followed and read for a name and pin, then matched on
 * Google (Text Search, ids only). `placeId` when Google has it, else the name the link gave, to add by hand.
 */
export async function findPlaceFromMapsLink(input: string): Promise<DataResult<{ placeId: string | null; name: string }>> {
  const parsed = readPlaceInput(input);
  if (!parsed || parsed.kind !== "link") return { data: null, error: "That isn't a Google Maps link." };
  const resolved = isShortMapsLink(parsed.url) ? ((await followMapsLink(parsed.url)) ?? parsed.url) : parsed.url;
  const { coordinates, name, area } = placeFromMapsUrl(resolved, parsed.url, parsed.label);
  // a dropped pin has no name to search for
  if (name === UNNAMED_PLACE) return { data: { placeId: null, name: "" } };
  const placeId = await serverBackend.findPlaceFromLink({ text: area ? `${name}, ${area}` : name, near: coordinates });
  return { data: { placeId, name } };
}

/** Saves a Google place picked in 21b, with our own kind and our area labels from Google's address */
export async function addGooglePlace(params: { placeId: string; kind: string; status: PlaceStatus }): Promise<DataResult<Place>> {
  if (!GOOGLE_ID.test(params.placeId)) return { data: null, error: "We couldn't find that place on Google." };
  // the preview already fetched it with extras, so this comes from the short cache
  const google = await serverBackend.getGooglePlace({ placeId: params.placeId, extras: true });
  if (!google) return { data: null, error: "Google didn't answer. Try again in a moment." };
  const { area, city, province, country } = google.address;
  return serverBackend.addPlace({
    name: google.name,
    category: clean(params.kind, 40) || kindFromGoogleType(google.primaryType),
    area: clean(area, 60),
    city: clean(city, 80),
    province: clean(province, 80),
    country: clean(country, 80),
    // a Google place's street is fetched fresh to show, not stored
    street: "",
    mapsUrl: null,
    status: params.status,
    googlePlaceId: google.placeId,
    location: google.location,
  });
}

export interface PlaceByHand {
  name: string;
  kind: string;
  street: string;
  area: string;
  city: string;
  province: string;
  country: string;
  status: PlaceStatus;
}

/** 21c: a place Google doesn't have */
export async function addPlaceByHand(form: PlaceByHand): Promise<DataResult<Place>> {
  const name = clean(form.name, 120);
  if (!name) return { data: null, error: "Give the place a name." };
  return serverBackend.addPlace({
    name,
    category: clean(form.kind, 40) || null,
    street: clean(form.street, 80),
    area: clean(form.area, 60),
    city: clean(form.city, 80),
    province: clean(form.province, 80),
    country: clean(form.country, 80),
    mapsUrl: null,
    status: form.status,
    googlePlaceId: null,
    location: null,
  });
}

/** 22: saves the edit form. A Google place keeps Google's street (shown fresh), so only by-hand places save one. */
export async function updatePlace(id: string, form: PlaceByHand): Promise<DataResult<Place>> {
  const name = clean(form.name, 120);
  if (!name) return { data: null, error: "Give the place a name." };
  return serverBackend.updatePlace({
    id,
    name,
    category: clean(form.kind, 40),
    status: form.status,
    street: clean(form.street, 80),
    area: clean(form.area, 60),
    city: clean(form.city, 80),
    province: clean(form.province, 80),
    country: clean(form.country, 80),
  });
}

/**
 * 22, Change place: the place becomes another Google place (picked in the search), keeping its name, kind, visits and
 * ratings. The area labels and coordinates come from the new place.
 */
export async function changeGooglePlace(id: string, placeId: string, sessionToken: string | null): Promise<DataResult<Place>> {
  const preview = await previewGooglePlace(placeId, sessionToken);
  const google = preview.data;
  if (!google) return { data: null, error: preview.error };
  const { data: place, error } = await serverBackend.getPlace({ id });
  if (!place) return { data: null, error };
  const { area, city, province, country } = google.address;
  return serverBackend.updatePlace({
    id,
    name: place.name,
    category: place.category,
    status: place.status,
    street: "",
    area: clean(area, 60),
    city: clean(city, 80),
    province: clean(province, 80),
    country: clean(country, 80),
    google: { placeId: google.placeId, location: google.location },
  });
}

export async function unlinkPlace(id: string): Promise<MutationResult> {
  return serverBackend.unlinkPlace({ id });
}

export async function deletePlace(id: string): Promise<MutationResult> {
  return serverBackend.deletePlace({ id });
}

/** 24: a visit, with your own rating (whole stars, 1–5). The place moves to Been. */
export async function logVisit(visit: NewVisit): Promise<DataResult<Place>> {
  const title = clean(visit.title, 120);
  if (!title) return { data: null, error: "Say what you did there." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(visit.day) || Number.isNaN(Date.parse(visit.day))) {
    return { data: null, error: "Pick a day for the visit." };
  }
  const rating = visit.rating === null ? null : Math.round(visit.rating);
  if (rating !== null && (rating < 1 || rating > 5)) return { data: null, error: "Ratings go from 1 to 5 stars." };
  const note = clean(visit.note ?? "", 500) || null;
  return serverBackend.logVisit({ placeId: visit.placeId, day: visit.day, title, note, rating });
}

const clean = (text: string, max: number) => text.trim().replace(/\s+/g, " ").slice(0, max);

function validCoordinates(point: Coordinates | null): Coordinates | null {
  if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return null;
  return Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180 ? { lat: point.lat, lng: point.lng } : null;
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
