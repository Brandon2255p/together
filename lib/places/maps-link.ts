import type { Coordinates } from "@/lib/models";

const MAPS_HOST = /(^|\.)google\.[a-z.]+$|^maps\.app\.goo\.gl$|^goo\.gl$/i;
const SHORT_HOST = /^maps\.app\.goo\.gl$|^goo\.gl$/i;
const URL_IN_TEXT = /https?:\/\/\S+/i;
/** "-25.79,28.27": a dropped pin, not a name */
const COORDINATES = /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/;

/** the name when a link has none (a dropped pin) */
export const UNNAMED_PLACE = "Pinned place";

export type PlaceInput = { kind: "name"; name: string } | { kind: "link"; url: URL; label: string | null };

export interface LinkAddress {
  street: string;
  area: string;
  city: string;
  province: string;
  country: string;
}

export const NO_ADDRESS: LinkAddress = { street: "", area: "", city: "", province: "", country: "" };

export interface PlaceDetails {
  name: string;
  /** the street and suburb or city, when the link carries an address: what we search Google with */
  area: string | null;
  /** the address the link spells out, split into our fields ("" when it doesn't say), for adding it by hand */
  address: LinkAddress;
  /** "7600", when the address has one: helps find the province and country when the link leaves them out */
  postalCode: string | null;
  mapsUrl: string | null;
  /** where the pin is, when the link says: helps the Places API pick the right match */
  coordinates: Coordinates | null;
}


/**
 * Reads what the user pasted: a plain name, a Google Maps link, or the text the Maps app shares
 * ("Woodlands Boulevard\nhttps://maps.app.goo.gl/…"), where the words before the link are the place's name.
 * Null when there's nothing usable or the link isn't Google Maps.
 */
export function readPlaceInput(input: string): PlaceInput | null {
  const text = input.trim();
  if (!text) return null;

  const match = URL_IN_TEXT.exec(text);
  if (!match) return { kind: "name", name: text.slice(0, 80) };

  let url: URL;
  try {
    url = new URL(match[0]);
  } catch {
    return null;
  }
  if (!MAPS_HOST.test(url.hostname)) return null;

  const label = text.replace(match[0], " ").replace(/\s+/g, " ").trim();
  return { kind: "link", url, label: label || null };
}

/** maps.app.goo.gl links (what the Maps app shares) say nothing until they're followed */
export function isShortMapsLink(url: URL): boolean {
  return SHORT_HOST.test(url.hostname);
}

export function isMapsUrl(url: URL): boolean {
  return MAPS_HOST.test(url.hostname);
}

/**
 * The name and area a Google Maps link spells out: /maps/place/<name, address>/, /maps/search/<…>/, ?q= or ?query=.
 * `resolved` is the link after following any redirects; `shared` is what the user pasted (kept as the link we open).
 */
export function placeFromMapsUrl(resolved: URL, shared: URL, label: string | null): PlaceDetails {
  const text = textFromMapsUrl(resolved);
  const [first, ...rest] = text ? splitAddress(text) : [];
  const name = label ?? first ?? UNNAMED_PLACE;
  // when the share text already gave the name, the link's first part may be the name again or the street
  const addressParts = label && first && !sameName(first, label) ? [first, ...rest] : rest;
  return {
    name: name.slice(0, 80),
    area: areaFrom(addressParts),
    address: addressFrom(addressParts),
    postalCode: addressParts.find((part) => POSTAL_CODE.test(part) && /\d{3}/.test(part))?.trim() ?? null,
    mapsUrl: shared.toString(),
    coordinates: coordinatesFrom(resolved),
  };
}

/** the pin (`!3d<lat>!4d<lng>` in /data=), else the map's centre (`/@lat,lng,zoom`), else `?q=lat,lng` */
function coordinatesFrom(url: URL): Coordinates | null {
  const text = safeDecode(url.pathname) + url.search;
  const match =
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(text) ??
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(text) ??
    /[?&]q=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)(?:&|$)/.exec(text);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

function textFromMapsUrl(url: URL): string | null {
  const fromPath = /\/maps\/(?:place|search)\/([^/@]+)/.exec(url.pathname)?.[1];
  const candidates = [
    fromPath ? safeDecode(fromPath.replace(/\+/g, " ")) : null,
    url.searchParams.get("q"),
    url.searchParams.get("query"),
  ];
  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value && !COORDINATES.test(value)) return value;
  }
  return null;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function splitAddress(text: string): string[] {
  return text
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

/** "Truth Coffee" and "Truth Coffee Roasting" are the same place */
function sameName(a: string, b: string): boolean {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x.includes(y) || y.includes(x);
}

const POSTAL_CODE = /^[\d\s-]+$/;
/** "IL 62701": a US state with its ZIP code */
const STATE_AND_ZIP = /^([A-Z]{2})\s+\d{5}(?:-\d{4})?$/;
const PLUS_CODE = /^\w{4}\+\w{2,}$/;

/**
 * Fits places.area (60 characters).
 * "De Villebois Mareuil Dr, Pretoria, 0081, South Africa" → "De Villebois Mareuil Dr, Pretoria":
 * drop the country (Google puts it after the postal code), postal codes and plus codes, then keep the last two parts.
 */
function areaFrom(parts: string[]): string | null {
  const last = parts.length - 1;
  const endsWithCountry = last > 0 && POSTAL_CODE.test(parts[last - 1] ?? "");
  const words = (endsWithCountry ? parts.slice(0, last) : parts).filter(
    (part) => !POSTAL_CODE.test(part) && !PLUS_CODE.test(part),
  );
  const area = words.slice(-2).join(", ");
  return area ? area.slice(0, 60) : null;
}

/**
 * The address a link spells out, as our fields. Google writes it street first and city last, then the postal code and
 * the country: "R44 Adam Tas St, Klapmuts, 7600" or "36 Buitenkant St, Cape Town City Centre, Cape Town, 8000, South
 * Africa". So: the part after a postal code is the country; postal and plus codes go; then the last part is the city,
 * the one before it the suburb (when there are three or more), and the rest the street.
 */
export function addressFrom(parts: string[]): LinkAddress {
  let province = "";
  let postalAt = -1;
  parts.forEach((part, i) => {
    const state = STATE_AND_ZIP.exec(part);
    if (state) province = state[1] ?? "";
    if (state || POSTAL_CODE.test(part)) postalAt = i;
  });
  const last = parts.length - 1;
  const country = postalAt >= 0 && postalAt === last - 1 ? (parts[last] ?? "") : "";
  const words = parts
    .slice(0, country ? last : parts.length)
    .filter((part) => !POSTAL_CODE.test(part) && !PLUS_CODE.test(part) && !STATE_AND_ZIP.test(part));
  const n = words.length;
  const city = n >= 1 ? (words[n - 1] ?? "") : "";
  const area = n >= 3 ? (words[n - 2] ?? "") : "";
  const street = n >= 2 ? words.slice(0, n >= 3 ? n - 2 : 1).join(", ") : "";
  return {
    street: street.slice(0, 80),
    area: area.slice(0, 60),
    city: city.slice(0, 80),
    province: province.slice(0, 80),
    country: country.slice(0, 80),
  };
}

/**
 * What to look up for a link's province and country, most specific first: the whole address, then the city with its
 * postal code, then the city alone (at most three, as each is a request). Empty when the link gave no city.
 */
export function regionQueries(address: LinkAddress, postalCode: string | null): string[] {
  if (!address.city) return [];
  const join = (parts: string[]) => parts.filter(Boolean).join(", ");
  const queries = [
    join([address.street, address.area, address.city, postalCode ?? ""]),
    join([address.city, postalCode ?? ""]),
    address.city,
  ];
  return [...new Set(queries)];
}
