import { TIME_ZONE } from "@/lib/format";
import type { FileFolder, Member, SharedFile, StorageUsage } from "@/lib/models";

// Pure helpers for the Files screens (39–41, 38): labels, sizes, filtering and the space check.

/** the short type on a file's tile: PDF, JPG, DOCX… from the name, else the MIME type */
export function typeLabel(name: string, mimeType: string): string {
  const ext = /\.([a-z0-9]{1,5})$/i.exec(name.trim())?.[1]?.toUpperCase();
  if (ext) return ext === "JPEG" ? "JPG" : ext;
  if (mimeType === "text/plain") return "TXT";
  const sub = mimeType.split("/")[1] ?? "";
  if (!sub || /^(vnd|x-)/.test(sub)) return "FILE";
  const short = sub.split(/[+;.-]/)[0]!.toUpperCase();
  return short.length <= 5 ? short : "FILE";
}

export type TypeTone = "accent" | "partner" | "success" | "warning";

/** documents red, images blue, sheets green, the rest yellow, as on the design's tiles */
export function typeTone(name: string, mimeType: string): TypeTone {
  const label = typeLabel(name, mimeType);
  if (mimeType.startsWith("image/") || ["JPG", "PNG", "HEIC", "WEBP", "GIF"].includes(label)) return "partner";
  if (["XLS", "XLSX", "CSV", "NUMBERS"].includes(label)) return "success";
  if (label === "PDF" || mimeType === "application/pdf") return "accent";
  return "warning";
}

const UNITS = ["KB", "MB", "GB", "TB"];

/** 840 KB, 1.2 MB, 31.6 GB: one decimal below 10, whole numbers above */
export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1000 && unit < UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  const shown = value < 10 ? value.toFixed(1).replace(/\.0$/, "") : String(Math.round(value));
  return `${shown} ${UNITS[unit]}`;
}

/** en-GB writes September "Sept"; the design uses three letters for every month */
const date = (iso: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", options).format(new Date(iso)).replace("Sept", "Sep");

/** "4 Nov 2026" in the Together's time zone */
export function shortDate(iso: string, timeZone = TIME_ZONE): string {
  return date(iso, { day: "numeric", month: "short", year: "numeric", timeZone });
}

/** "3 Nov" */
export function dayAndMonth(iso: string, timeZone = TIME_ZONE): string {
  return date(iso, { day: "numeric", month: "short", timeZone });
}

/** "30 Oct 2026, 09:14" */
export function dateAndTime(iso: string, timeZone = TIME_ZONE): string {
  return date(iso, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone });
}

/** who added it, as the rows say it: "You", a name, or "Someone" when they've deleted their account */
export function addedByName(uploadedBy: string | null, people: Pick<Member, "id" | "name">[], meId: string): string {
  if (!uploadedBy) return "Someone";
  if (uploadedBy === meId) return "You";
  return people.find((p) => p.id === uploadedBy)?.name ?? "Someone";
}

/** "Adele · 4 Nov 2026 · 1.2 MB" */
export function fileMeta(file: SharedFile, people: Pick<Member, "id" | "name">[], meId: string): string {
  return [addedByName(file.uploadedBy, people, meId), shortDate(file.createdAt), formatBytes(file.sizeBytes)].join(" · ");
}

/** files per folder */
export function folderCounts(files: SharedFile[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const f of files) if (f.folderId) counts[f.folderId] = (counts[f.folderId] ?? 0) + 1;
  return counts;
}

export const countLabel = (n: number, noun = "file") => `${n} ${noun}${n === 1 ? "" : "s"}`;

/** the tag chips: the most used tags first (then A–Z), at most `limit` */
export function topTags(files: SharedFile[], limit = 8): string[] {
  const uses = new Map<string, number>();
  for (const f of files) for (const t of f.tags) uses.set(t, (uses.get(t) ?? 0) + 1);
  return [...uses].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([t]) => t);
}

/** "id" → "ID", "passport" → "Passport": tags are stored lowercased */
export function tagLabel(tag: string): string {
  if (tag.length <= 2) return tag.toUpperCase();
  return tag.charAt(0).toUpperCase() + tag.slice(1);
}

/** trims, lowercases and drops empties and repeats, as the database does */
export function normaliseTags(tags: string[]): string[] {
  return [...new Set(tags.map((t) => t.trim().toLowerCase()).filter((t) => t && t.length <= 30))].sort();
}

/**
 * Documents matching the search box and a tag chip. Every word has to match the name, a tag, the folder's name or
 * who added it.
 */
export function filterDocuments(
  files: SharedFile[],
  { query, tag, folders, people, meId }: { query: string; tag: string | null; folders: FileFolder[]; people: Pick<Member, "id" | "name">[]; meId: string },
): SharedFile[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const folderName = new Map(folders.map((f) => [f.id, f.name.toLowerCase()]));
  return files.filter((f) => {
    if (tag && !f.tags.includes(tag)) return false;
    if (!words.length) return true;
    const haystack = [f.name.toLowerCase(), ...f.tags, f.folderId ? (folderName.get(f.folderId) ?? "") : "", addedByName(f.uploadedBy, people, meId).toLowerCase()].join(" ");
    return words.every((w) => haystack.includes(w));
  });
}

/** whether files of these encrypted sizes fit, and the message when they don't (sent before anything is uploaded) */
export function spaceCheck(usage: Pick<StorageUsage, "quotaBytes" | "usedBytes">, sizes: number[]): { fits: true } | { fits: false; message: string } {
  const needed = sizes.reduce((sum, s) => sum + s, 0);
  const left = Math.max(usage.quotaBytes - usage.usedBytes, 0);
  if (needed <= left) return { fits: true };
  const these = sizes.length === 1 ? "this needs" : "these need";
  return { fits: false, message: `Not enough space: ${these} ${formatBytes(needed)} and ${formatBytes(left)} is left. Empty the bin or remove something first.` };
}

/** "3 files added · 1 skipped" */
export function uploadSummary(added: number, skipped: number): { title: string; overline: string } {
  const title = added === 0 ? "Nothing new added" : `${countLabel(added)} added`;
  const overline = skipped ? `Upload done · ${skipped} skipped` : "Upload done";
  return { title, overline };
}
