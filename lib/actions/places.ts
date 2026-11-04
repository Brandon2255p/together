"use server";

import { serverBackend } from "@/lib/backend/server";
import type { PlaceStatus } from "@/lib/models";
import { isMapsUrl, isShortMapsLink, placeFromMapsUrl, readPlaceInput } from "@/lib/places/maps-link";

export async function getPlaces() {
  return serverBackend.getPlaces();
}

export async function getPlace(id: string) {
  return serverBackend.getPlace({ id });
}

/** `input`: a Google Maps link, the text the Maps app shares, or just a name */
export async function addPlace(input: string, status: PlaceStatus) {
  const parsed = readPlaceInput(input);
  if (!parsed) return { data: null, error: "Paste a Google Maps link or type the place's name." };
  if (parsed.kind === "name") return serverBackend.addPlace({ name: parsed.name, area: null, mapsUrl: null, status });

  const resolved = isShortMapsLink(parsed.url) ? ((await followMapsLink(parsed.url)) ?? parsed.url) : parsed.url;
  return serverBackend.addPlace({ ...placeFromMapsUrl(resolved, parsed.url, parsed.label), status });
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
