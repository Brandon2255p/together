import type { NewPlace } from "@/lib/models";

const MAPS_HOST = /(^|\.)google\.[a-z.]+$|^maps\.app\.goo\.gl$|^goo\.gl$/i;

/**
 * Reads what the user pasted: a Google Maps link (we take the place name from /maps/place/<name>/ when it's there)
 * or a plain name. Null when there's nothing usable.
 */
export function placeFromInput(input: string): Pick<NewPlace, "name" | "mapsUrl"> | null {
  const text = input.trim();
  if (!text) return null;

  let url: URL | null = null;
  try {
    url = new URL(text);
  } catch {
    url = null;
  }

  if (!url) return { name: text.slice(0, 80), mapsUrl: null };
  if (!MAPS_HOST.test(url.hostname)) return null;

  const match = /\/maps\/place\/([^/]+)/.exec(url.pathname);
  const fromPath = match?.[1] ? decodeURIComponent(match[1].replace(/\+/g, " ")).trim() : "";
  const fromQuery = url.searchParams.get("q")?.trim() ?? "";
  const name = fromPath || fromQuery || "Pinned place";
  return { name: name.slice(0, 80), mapsUrl: url.toString() };
}
