import type { GooglePlaceDetails } from "@/lib/models";

// Shaping Google's answers for Add a place (21a–b) and the place page (23).

/** a name split into plain and matched runs, for highlighting what was typed; bad or overlapping offsets are ignored */
export function highlightParts(text: string, matches: [number, number][]): { text: string; match: boolean }[] {
  const parts: { text: string; match: boolean }[] = [];
  let at = 0;
  for (const [rawStart, rawEnd] of [...matches].sort((a, b) => a[0] - b[0])) {
    const start = Math.max(rawStart, at);
    const end = Math.min(rawEnd, text.length);
    if (end <= start) continue;
    if (start > at) parts.push({ text: text.slice(at, start), match: false });
    parts.push({ text: text.slice(start, end), match: true });
    at = end;
  }
  if (at < text.length) parts.push({ text: text.slice(at), match: false });
  return parts;
}

/** Google's price level as rands: "R R R"; "Free" for 0; null when Google doesn't say */
export function priceLabel(level: number | null | undefined): string | null {
  if (level === null || level === undefined || level < 0 || level > 4) return null;
  return level === 0 ? "Free" : Array.from({ length: level }, () => "R").join(" ");
}

/** "Open until 22:00", "Open now" or "Closed now"; null when Google doesn't know the hours */
export function hoursLabel(google: Pick<GooglePlaceDetails, "openNow" | "closesAt"> | null): { text: string; open: boolean } | null {
  if (google?.openNow === true) return { text: google.closesAt ? `Open until ${google.closesAt}` : "Open now", open: true };
  if (google?.openNow === false) return { text: "Closed now", open: false };
  return null;
}

/** pasted text that's a link rather than a search: the Maps app shares "Name https://maps.app.goo.gl/…" */
export const looksLikeLink = (text: string) => /https?:\/\/\S/i.test(text);
