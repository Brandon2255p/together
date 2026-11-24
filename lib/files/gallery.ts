import { TIME_ZONE } from "@/lib/format";
import type { FileKind, Member, MonthCount, SharedFile } from "@/lib/models";
import { addedByName } from "./documents";

// Pure helpers for the Gallery (screens 36 and 37): kinds, months, labels, filtering and thumbnail sizes.

export type GalleryKind = "photo" | "video";
/** the chips: All, Photos, Videos */
export type GalleryFilter = "all" | GalleryKind;

/** what the Gallery keeps a file as, from its MIME type; null for anything that isn't a photo or video */
export function mediaKind(mimeType: string, name = ""): GalleryKind | null {
  if (mimeType.startsWith("image/")) return "photo";
  if (mimeType.startsWith("video/")) return "video";
  // some browsers leave HEIC and a few video types blank
  if (/\.(heic|heif)$/i.test(name)) return "photo";
  if (/\.(mov|mp4|m4v)$/i.test(name)) return "video";
  return null;
}

const parts = (iso: string, timeZone: string) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "numeric", timeZone })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );

/** the year and month (1–12) of an instant, in the Together's time zone */
export function monthOf(iso: string, timeZone = TIME_ZONE): { year: number; month: number } {
  const p = parts(iso, timeZone);
  return { year: Number(p.year), month: Number(p.month) };
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "9 photos · 1 video", for the chip that's on */
export function monthSummary(count: Pick<MonthCount, "photos" | "videos">, filter: GalleryFilter = "all"): string {
  const photos = filter === "video" ? 0 : count.photos;
  const videos = filter === "photo" ? 0 : count.videos;
  const bits = [photos ? `${photos} photo${photos === 1 ? "" : "s"}` : null, videos ? `${videos} video${videos === 1 ? "" : "s"}` : null];
  return bits.filter(Boolean).join(" · ") || "Nothing yet";
}

export interface MonthGroup<T> {
  key: string;
  /** "November 2026" */
  title: string;
  /** "9 photos · 1 video": the whole month, even before every page has loaded */
  summary: string;
  items: T[];
}

/** loaded items (newest taken first) grouped by month, with each month's full counts from `months` */
export function groupByMonth<T extends Pick<SharedFile, "takenAt" | "kind">>(
  items: T[],
  months: MonthCount[],
  { filter = "all", timeZone = TIME_ZONE }: { filter?: GalleryFilter; timeZone?: string } = {},
): MonthGroup<T>[] {
  const counts = new Map(months.map((m) => [`${m.year}-${m.month}`, m]));
  const groups: MonthGroup<T>[] = [];
  for (const item of items) {
    const { year, month } = monthOf(item.takenAt, timeZone);
    const key = `${year}-${month}`;
    let group = groups.at(-1);
    if (group?.key !== key) {
      // a month missing from the counts (just uploaded) counts what's loaded
      const count = counts.get(key) ?? {
        photos: items.filter((i) => i.kind === "photo" && sameMonth(i.takenAt, year, month, timeZone)).length,
        videos: items.filter((i) => i.kind === "video" && sameMonth(i.takenAt, year, month, timeZone)).length,
      };
      group = { key, title: `${MONTHS[month - 1]} ${year}`, summary: monthSummary(count, filter), items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

const sameMonth = (iso: string, year: number, month: number, timeZone: string) => {
  const m = monthOf(iso, timeZone);
  return m.year === year && m.month === month;
};

/** adds what was just uploaded to the month counts */
export function addToMonths(months: MonthCount[], added: Pick<SharedFile, "takenAt" | "kind">[], timeZone = TIME_ZONE): MonthCount[] {
  const next = new Map(months.map((m) => [`${m.year}-${m.month}`, { ...m }]));
  for (const item of added) {
    if (item.kind === "document") continue;
    const { year, month } = monthOf(item.takenAt, timeZone);
    const m = next.get(`${year}-${month}`) ?? { year, month, photos: 0, videos: 0 };
    if (item.kind === "photo") m.photos++;
    else m.videos++;
    next.set(`${year}-${month}`, m);
  }
  return [...next.values()].sort((a, b) => b.year - a.year || b.month - a.month);
}

/** takes a binned item off its month's count */
export function removeFromMonths(months: MonthCount[], item: Pick<SharedFile, "takenAt" | "kind">, timeZone = TIME_ZONE): MonthCount[] {
  const { year, month } = monthOf(item.takenAt, timeZone);
  return months.map((m) =>
    m.year === year && m.month === month
      ? { ...m, photos: Math.max(m.photos - (item.kind === "photo" ? 1 : 0), 0), videos: Math.max(m.videos - (item.kind === "video" ? 1 : 0), 0) }
      : m,
  );
}

/** newest taken first, the way the server pages them */
export const byTakenDesc = (a: Pick<SharedFile, "takenAt" | "id">, b: Pick<SharedFile, "takenAt" | "id">) =>
  b.takenAt.localeCompare(a.takenAt) || b.id.localeCompare(a.id);

/** a video's length on its tile: "0:42", "12:05", "1:02:03" */
export function durationLabel(ms: number): string {
  const total = Math.max(Math.round(ms / 1000), 0);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

const format = (iso: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", options).format(new Date(iso)).replace("Sept", "Sep").replace(",", "");

/** the viewer's title: "Wed 12 Nov 2026" */
export function viewerDate(iso: string, timeZone = TIME_ZONE): string {
  return format(iso, { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone });
}

/** "Taken Wed 12 Nov 2026, 18:42" */
export function takenLine(iso: string, timeZone = TIME_ZONE): string {
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone }).format(new Date(iso));
  return `Taken ${viewerDate(iso, timeZone)}, ${time}`;
}

/** "3 of 10 · November": where an item sits among the shown items of its month */
export function positionLabel(item: Pick<SharedFile, "id" | "takenAt">, shown: Pick<SharedFile, "id" | "takenAt">[], timeZone = TIME_ZONE): string {
  const { year, month } = monthOf(item.takenAt, timeZone);
  const inMonth = shown.filter((i) => sameMonth(i.takenAt, year, month, timeZone));
  const index = inMonth.findIndex((i) => i.id === item.id);
  return `${index + 1} of ${inMonth.length} · ${MONTHS[month - 1]}`;
}

/** photos and videos matching the chip and the search box (every word has to match the name or who added it) */
export function filterGallery<T extends Pick<SharedFile, "kind" | "name" | "uploadedBy">>(
  items: T[],
  { filter, query, people, meId }: { filter: GalleryFilter; query: string; people: Pick<Member, "id" | "name">[]; meId: string },
): T[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return items.filter((item) => {
    if (filter !== "all" && item.kind !== filter) return false;
    if (!words.length) return true;
    const haystack = `${item.name} ${addedByName(item.uploadedBy, people, meId)}`.toLowerCase();
    return words.every((w) => haystack.includes(w));
  });
}

/**
 * The size to draw a thumbnail or preview at: never bigger than the original. A thumb's shorter side is `edge` (so a
 * square tile can crop it sharply); a preview's longer side is `edge`.
 */
export function scaledSize(width: number, height: number, edge: number, fit: "short" | "long"): { width: number; height: number } {
  const side = fit === "short" ? Math.min(width, height) : Math.max(width, height);
  const scale = Math.min(edge / side, 1);
  return { width: Math.max(Math.round(width * scale), 1), height: Math.max(Math.round(height * scale), 1) };
}

/**
 * When a photo was taken, from its EXIF "2026:11:12 18:42:10" and offset "+02:00". Without an offset the clock time
 * is read in the Together's time zone (phones rarely leave it out). Null when the EXIF date is missing or nonsense.
 */
export function exifTakenAt(raw: unknown, offset: unknown, timeZone = TIME_ZONE): string | null {
  if (typeof raw !== "string") return null;
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(raw.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m.map(Number) as [number, number, number, number, number, number, number];
  if (y < 1900 || mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null;
  const wall = Date.UTC(y, mo - 1, d, h, mi, s);
  const off = typeof offset === "string" ? /^([+-])(\d{2}):?(\d{2})$/.exec(offset.trim()) : null;
  if (off) {
    const minutes = (off[1] === "-" ? -1 : 1) * (Number(off[2]) * 60 + Number(off[3]));
    return new Date(wall - minutes * 60_000).toISOString();
  }
  return new Date(wall - zoneOffsetMs(wall, timeZone)).toISOString();
}

/** how far ahead of UTC a time zone's clocks were around this (wall-clock) instant */
function zoneOffsetMs(wall: number, timeZone: string): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" })
      .formatToParts(new Date(wall))
      .map((x) => [x.type, x.value]),
  );
  return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second)) - wall;
}

/** "Brandon added this · 13 Nov" */
export function addedLine(file: Pick<SharedFile, "uploadedBy" | "createdAt">, people: Pick<Member, "id" | "name">[], meId: string, timeZone = TIME_ZONE): string {
  const who = addedByName(file.uploadedBy, people, meId);
  const day = format(file.createdAt, { day: "numeric", month: "short", timeZone });
  return `${who} added this · ${day}`;
}

export const isGalleryKind = (kind: FileKind): kind is GalleryKind => kind === "photo" || kind === "video";
