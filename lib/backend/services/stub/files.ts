import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { deflateSync } from "node:zlib";
import { addDays, todayKey } from "@/lib/format";
import { contentMac, encryptFile, importTogetherKey } from "@/lib/files/crypto";
import type { DuplicateMatch, FileFolder, Hue, NewUpload, SharedFile, UploadTarget } from "@/lib/models";
import { ADELE, BRANDON } from "@/lib/backend/services/stub/seed";
import { SAMPLE_CLIP_MP4, SAMPLE_CLIP_MS } from "@/lib/backend/services/stub/sample-clip";

// The stub's shared files: per Together, a key, folders and file rows, plus an in-memory "bucket" of encrypted objects
// that /api/stub/storage serves. Seed documents are really encrypted with the Together's key, so the stub exercises
// the same decrypt path as Supabase. Kept across hot reloads on globalThis.

export const QUOTA_BYTES = 50 * 1024 ** 3;

export interface StubFileRow extends SharedFile {
  contentMac: string;
  status: "uploading" | "ready";
  deletedAt: string | null;
}

export interface StubFiles {
  key: string;
  folders: (FileFolder & { createdAt: string })[];
  files: StubFileRow[];
}

interface StubBucket {
  objects: Map<string, Uint8Array>;
  /** path → its signed upload's token and the exact size it accepts */
  uploads: Map<string, { token: string; bytes: number }>;
  togethers: Map<string, Promise<StubFiles>>;
}

const g = globalThis as unknown as { __togetherStubFiles?: StubBucket };
const bucket = (): StubBucket => (g.__togetherStubFiles ??= { objects: new Map(), uploads: new Map(), togethers: new Map() });

/** a Together's files, seeded the first time it's asked for */
export function filesOf(togetherId: string): Promise<StubFiles> {
  const b = bucket();
  let files = b.togethers.get(togetherId);
  if (!files) {
    files = togetherId === "t-1" ? seedBrandonAndAdele(togetherId) : Promise.resolve(empty());
    b.togethers.set(togetherId, files);
  }
  return files;
}

const empty = (): StubFiles => ({ key: randomBytes(32).toString("base64"), folders: [], files: [] });

export const objectPath = (togetherId: string, fileId: string, part: "original" | "thumb" | "preview" = "original") => `${togetherId}/${fileId}/${part}.bin`;

/** a signed upload: the path may then be written once, with exactly `bytes` bytes, by POSTing these fields */
export function signUpload(path: string, bytes: number): UploadTarget {
  const token = randomUUID();
  bucket().uploads.set(path, { token, bytes });
  return { path, url: "/api/stub/storage", fields: { key: path, token } };
}

/** what /api/stub/storage reads and writes */
export const stubStorage = {
  get: (path: string) => bucket().objects.get(path) ?? null,
  put(path: string, token: string, bytes: Uint8Array): boolean {
    const b = bucket();
    const signed = b.uploads.get(path);
    if (!token || signed?.token !== token || signed.bytes !== bytes.length) return false;
    b.uploads.delete(path);
    b.objects.set(path, bytes);
    return true;
  },
  remove(paths: (string | null)[]) {
    const b = bucket();
    for (const p of paths) {
      if (!p) continue;
      b.objects.delete(p);
      b.uploads.delete(p);
    }
  },
};

/** an unfinished upload that a fresh one of the same file may clear: yours, or anyone's past its URLs' 15 minutes */
export const isStuckUpload = (row: StubFileRow, me: string, now = Date.now()) =>
  row.status === "uploading" && (row.uploadedBy === me || now - Date.parse(row.createdAt) > 20 * 60 * 1000);

export function duplicateMatches(files: StubFiles, macs: string[], names: Record<string, string>): DuplicateMatch[] {
  return files.files
    .filter((f) => f.status === "ready" && macs.includes(f.contentMac))
    .map((f) => ({
      contentMac: f.contentMac,
      fileId: f.id,
      name: f.name,
      uploadedByName: f.uploadedBy ? (names[f.uploadedBy] ?? null) : null,
      createdAt: f.createdAt,
      inBin: f.deletedAt !== null,
    }));
}

export function newRow(togetherId: string, upload: NewUpload, by: string): StubFileRow {
  const now = new Date().toISOString();
  return {
    id: upload.id,
    kind: upload.kind,
    name: upload.name,
    mimeType: upload.mimeType,
    sizeBytes: upload.sizeBytes,
    storedBytes: upload.storedBytes,
    keyVersion: upload.keyVersion,
    originalPath: objectPath(togetherId, upload.id),
    folderId: upload.folderId,
    tags: normaliseTags(upload.tags),
    uploadedBy: by,
    createdAt: now,
    takenAt: upload.takenAt ?? now,
    thumbPath: upload.thumbBytes ? objectPath(togetherId, upload.id, "thumb") : null,
    previewPath: upload.previewBytes ? objectPath(togetherId, upload.id, "preview") : null,
    width: upload.width,
    height: upload.height,
    durationMs: upload.kind === "video" ? upload.durationMs : null,
    contentMac: upload.contentMac,
    status: "uploading",
    deletedAt: null,
  };
}

/** the row as the app sees it, without the stub's bookkeeping */
export function toSharedFile(row: StubFileRow): SharedFile {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    storedBytes: row.storedBytes,
    keyVersion: row.keyVersion,
    originalPath: row.originalPath,
    folderId: row.folderId,
    tags: [...row.tags],
    uploadedBy: row.uploadedBy,
    createdAt: row.createdAt,
    takenAt: row.takenAt,
    thumbPath: row.thumbPath,
    previewPath: row.previewPath,
    width: row.width,
    height: row.height,
    durationMs: row.durationMs,
  };
}

/** as triggers/files_guard.sql does it */
export const normaliseTags = (tags: string[]) =>
  [...new Set(tags.map((t) => t.trim().toLowerCase()).filter((t) => t && t.length <= 30))].sort();

// ---- Seed ------------------------------------------------------------------------------------------------------------

/** a one-page PDF that says `title`, so Open shows something real */
function pdf(title: string): Uint8Array {
  const text = title.replace(/[()\\]/g, "");
  const stream = `BT /F1 20 Tf 60 760 Td (${text}) Tj 0 -30 Td /F1 12 Tf (A sample document from the Together stub.) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}

type Rgb = [number, number, number];

/** a PNG that fades from `top` to `bottom`, standing in for a photo (a plain colour when they're the same) */
function png(width: number, height: number, top: Rgb, bottom: Rgb = top): Uint8Array {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (bytes: Buffer) => {
    let c = 0xffffffff;
    for (const byte of bytes) c = crcTable[(c ^ byte) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([length, body, sum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const rows = Array.from({ length: height }, (_, y) => {
    const t = height > 1 ? y / (height - 1) : 0;
    const colour = top.map((c, i) => Math.round(c + (bottom[i]! - c) * t));
    return Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: width }, () => colour).flat())]);
  });
  const pixels = deflateSync(Buffer.concat(rows));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", pixels), chunk("IEND", Buffer.alloc(0))]);
}

async function seedBrandonAndAdele(togetherId: string): Promise<StubFiles> {
  const files = empty();
  const key = await importTogetherKey(files.key, 1);
  const today = todayKey();
  const at = (days: number, time = "09:14") => new Date(`${addDays(today, days)}T${time}:00+02:00`).toISOString();

  const folder = (name: string, hue: Hue, days: number) => {
    const f = { id: randomUUID(), name, hue, createdAt: at(days) };
    files.folders.push(f);
    return f.id;
  };
  const home = folder("Home & lease", "accent", -90);
  folder("Health", "warning", -80);
  const ids = folder("IDs", "success", -70);
  const car = folder("Car", "partner", -60);

  const docs: { name: string; folderId: string | null; tags: string[]; by: string; days: number; bytes: Uint8Array; mime: string }[] = [
    { name: "Passport — Brandon.pdf", folderId: ids, tags: ["passport", "id"], by: ADELE.id, days: -19, bytes: pdf("Passport - Brandon"), mime: "application/pdf" },
    { name: "Car licence disc 2026.png", folderId: car, tags: ["car"], by: BRANDON.id, days: -21, bytes: png(320, 200, [108, 123, 255]), mime: "image/png" },
    { name: "Insurance schedule — Polo.pdf", folderId: car, tags: ["car", "insurance"], by: ADELE.id, days: -24, bytes: pdf("Insurance schedule - Polo"), mime: "application/pdf" },
    { name: "Lease agreement — Sea Point.pdf", folderId: home, tags: ["house"], by: BRANDON.id, days: -26, bytes: pdf("Lease agreement - Sea Point"), mime: "application/pdf" },
    { name: "Service history.pdf", folderId: car, tags: ["car"], by: BRANDON.id, days: -72, bytes: pdf("Service history"), mime: "application/pdf" },
    { name: "Adele ID card.pdf", folderId: ids, tags: ["id"], by: ADELE.id, days: -150, bytes: pdf("ID card - Adele"), mime: "application/pdf" },
    { name: "Wifi and alarm codes.pdf", folderId: null, tags: ["house"], by: BRANDON.id, days: -200, bytes: pdf("Wifi and alarm codes"), mime: "application/pdf" },
  ];
  const seal = async (id: string, part: "original" | "thumb" | "preview", bytes: Uint8Array) => {
    const sealed = new Uint8Array(await (await encryptFile(new Blob([bytes as Uint8Array<ArrayBuffer>]), key, id)).arrayBuffer());
    const path = objectPath(togetherId, id, part);
    bucket().objects.set(path, sealed);
    return { path, size: sealed.length };
  };

  const add = async (item: {
    kind: SharedFile["kind"];
    name: string;
    mime: string;
    bytes: Uint8Array;
    by: string;
    added: string;
    taken: string;
    folderId?: string | null;
    tags?: string[];
    thumb?: Uint8Array;
    preview?: Uint8Array;
    width?: number;
    height?: number;
    durationMs?: number;
  }) => {
    const id = randomUUID();
    const original = await seal(id, "original", item.bytes);
    const thumb = item.thumb ? await seal(id, "thumb", item.thumb) : null;
    const preview = item.preview ? await seal(id, "preview", item.preview) : null;
    files.files.push({
      id,
      kind: item.kind,
      name: item.name,
      mimeType: item.mime,
      sizeBytes: item.bytes.length,
      storedBytes: original.size + (thumb?.size ?? 0) + (preview?.size ?? 0),
      keyVersion: 1,
      originalPath: original.path,
      folderId: item.folderId ?? null,
      tags: normaliseTags(item.tags ?? []),
      uploadedBy: item.by,
      createdAt: item.added,
      takenAt: item.taken,
      thumbPath: thumb?.path ?? null,
      previewPath: preview?.path ?? null,
      width: item.width ?? null,
      height: item.height ?? null,
      durationMs: item.durationMs ?? null,
      contentMac: await contentMac(new Blob([item.bytes as Uint8Array<ArrayBuffer>]), key),
      status: "ready",
      deletedAt: null,
    });
  };

  for (const doc of docs) {
    await add({ kind: "document", name: doc.name, mime: doc.mime, bytes: doc.bytes, by: doc.by, added: at(doc.days), taken: at(doc.days), folderId: doc.folderId, tags: doc.tags });
  }

  // the Gallery: photos over the last three months (as the design's tiles: soft gradients), and one short video
  const photos: { top: Rgb; bottom: Rgb; days: number; time: string; by: string }[] = [
    { top: [244, 184, 150], bottom: [209, 106, 76], days: -1, time: "18:42", by: BRANDON.id },
    { top: [150, 178, 196], bottom: [84, 116, 140], days: -2, time: "12:05", by: ADELE.id },
    { top: [163, 196, 150], bottom: [96, 130, 88], days: -4, time: "08:30", by: ADELE.id },
    { top: [245, 205, 175], bottom: [226, 150, 104], days: -5, time: "17:10", by: BRANDON.id },
    { top: [210, 196, 170], bottom: [150, 124, 96], days: -6, time: "10:21", by: ADELE.id },
    { top: [228, 172, 186], bottom: [176, 112, 132], days: -8, time: "19:55", by: BRANDON.id },
    { top: [196, 186, 232], bottom: [118, 104, 184], days: -9, time: "14:02", by: ADELE.id },
    { top: [246, 222, 168], bottom: [220, 164, 72], days: -11, time: "07:48", by: BRANDON.id },
    { top: [190, 186, 180], bottom: [130, 120, 110], days: -34, time: "16:30", by: ADELE.id },
    { top: [170, 204, 196], bottom: [100, 150, 140], days: -37, time: "11:11", by: BRANDON.id },
    { top: [240, 204, 186], bottom: [214, 150, 120], days: -40, time: "09:45", by: ADELE.id },
    { top: [180, 196, 226], bottom: [104, 130, 190], days: -44, time: "13:20", by: BRANDON.id },
    { top: [236, 214, 196], bottom: [196, 160, 128], days: -66, time: "18:05", by: ADELE.id },
    { top: [206, 226, 186], bottom: [140, 176, 110], days: -70, time: "15:40", by: BRANDON.id },
  ];
  for (const [i, p] of photos.entries()) {
    const taken = at(p.days, p.time);
    const bytes = png(1200, 900, p.top, p.bottom);
    // a day or so later, as people add them
    const added = new Date(Math.min(Date.parse(taken) + 26 * 3600_000, Date.now())).toISOString();
    await add({ kind: "photo", name: `IMG_${2041 - i}.png`, mime: "image/png", bytes, by: p.by, added, taken, thumb: png(400, 300, p.top, p.bottom), preview: bytes, width: 1200, height: 900 });
  }
  const clipTaken = at(-3, "17:32");
  await add({
    kind: "video",
    name: "Sunset walk.mp4",
    mime: "video/mp4",
    bytes: Buffer.from(SAMPLE_CLIP_MP4, "base64"),
    by: ADELE.id,
    added: clipTaken,
    taken: clipTaken,
    thumb: png(400, 300, [108, 123, 255], [43, 45, 82]),
    width: 320,
    height: 240,
    durationMs: SAMPLE_CLIP_MS,
  });

  files.files.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return files;
}
