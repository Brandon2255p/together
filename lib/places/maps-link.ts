const MAPS_HOST = /(^|\.)google\.[a-z.]+$|^maps\.app\.goo\.gl$|^goo\.gl$/i;
const SHORT_HOST = /^maps\.app\.goo\.gl$|^goo\.gl$/i;
const URL_IN_TEXT = /https?:\/\/\S+/i;
/** "-25.79,28.27": a dropped pin, not a name */
const COORDINATES = /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/;

export type PlaceInput = { kind: "name"; name: string } | { kind: "link"; url: URL; label: string | null };

export interface PlaceDetails {
  name: string;
  /** the street and suburb or city, when the link carries an address */
  area: string | null;
  mapsUrl: string | null;
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
  const name = label ?? first ?? "Pinned place";
  // when the share text already gave the name, the link's first part may be the name again or the street
  const addressParts = label && first && !sameName(first, label) ? [first, ...rest] : rest;
  return { name: name.slice(0, 80), area: areaFrom(addressParts), mapsUrl: shared.toString() };
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
const PLUS_CODE = /^\w{4}\+\w{2,}$/;

/**
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
  return area ? area.slice(0, 80) : null;
}
