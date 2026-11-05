import "server-only";

/**
 * OpenStreetMap's Nominatim, server only: the province and country for an address a Google Maps link spelled out
 * without them ("R44 Adam Tas St, Klapmuts, 7600"), when Google Places doesn't know the place. Best effort: null when
 * nothing matches or it doesn't answer in time.
 *
 * Its usage policy: at most one request a second, a User-Agent that names the app, and cache results.
 * https://operations.osmfoundation.org/policies/nominatim/
 */

const API = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "Together/1.0 (shared lists, calendar and places app)";
const TIMEOUT_MS = 3000;
const CACHE_MS = 24 * 60 * 60 * 1000;

export interface Region {
  province: string;
  country: string;
}

const cache = new Map<string, { at: number; value: Region | null }>();
let last = 0;

async function search(query: string): Promise<Region | null> {
  const key = query.toLowerCase();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;

  // one request a second
  const wait = last + 1000 - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  last = Date.now();

  const params = new URLSearchParams({ q: query, format: "jsonv2", addressdetails: "1", limit: "1", "accept-language": "en" });
  try {
    const response = await fetch(`${API}?${params.toString()}`, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error("[geocode]", response.status);
      return null;
    }
    const results = (await response.json()) as { address?: { state?: string; country?: string } }[];
    const address = results[0]?.address;
    const value = address?.country ? { province: address.state ?? "", country: address.country } : null;
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch (error) {
    console.error("[geocode]", error);
    return null;
  }
}

/** tries each query in turn, most specific first, and stops at the first match */
export async function regionFor(queries: string[]): Promise<Region | null> {
  for (const query of queries) {
    const region = await search(query);
    if (region) return region;
  }
  return null;
}
