import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { deflateSync } from "node:zlib";
import { addDays, todayKey } from "@/lib/format";
import { contentMac, encryptFile, importTogetherKey } from "@/lib/files/crypto";
import type { DuplicateMatch, FileFolder, Hue, NewUpload, SharedFile } from "@/lib/models";
import { ADELE, BRANDON } from "@/lib/backend/services/stub/seed";

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
  /** path → the token its signed upload was given */
  uploads: Map<string, string>;
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

export const objectPath = (togetherId: string, fileId: string) => `${togetherId}/${fileId}/original.bin`;

/** a signed upload: the path may then be written once with this token */
export function signUpload(path: string): string {
  const token = randomUUID();
  bucket().uploads.set(path, token);
  return token;
}

/** what /api/stub/storage reads and writes */
export const stubStorage = {
  get: (path: string) => bucket().objects.get(path) ?? null,
  put(path: string, token: string, bytes: Uint8Array): boolean {
    const b = bucket();
    if (!token || b.uploads.get(path) !== token) return false;
    b.uploads.delete(path);
    b.objects.set(path, bytes);
    return true;
  },
};

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
    contentMac: upload.contentMac,
    status: "uploading",
    deletedAt: null,
  };
}

/** the row as the app sees it, without the stub's bookkeeping */
export function toSharedFile(row: StubFileRow): SharedFile {
  const { id, kind, name, mimeType, sizeBytes, storedBytes, keyVersion, originalPath, folderId, tags, uploadedBy, createdAt, takenAt } = row;
  return { id, kind, name, mimeType, sizeBytes, storedBytes, keyVersion, originalPath, folderId, tags: [...tags], uploadedBy, createdAt, takenAt };
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

/** a plain coloured PNG, standing in for a phone photo of a card */
function png(width: number, height: number, [r, g, b]: [number, number, number]): Uint8Array {
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
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: width }, () => [r, g, b]).flat())]);
  const pixels = deflateSync(Buffer.concat(Array.from({ length: height }, () => row)));
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
  for (const doc of docs) {
    const id = randomUUID();
    const plain = new Blob([doc.bytes as Uint8Array<ArrayBuffer>]);
    const sealed = new Uint8Array(await (await encryptFile(plain, key, id)).arrayBuffer());
    const path = objectPath(togetherId, id);
    bucket().objects.set(path, sealed);
    files.files.push({
      id,
      kind: "document",
      name: doc.name,
      mimeType: doc.mime,
      sizeBytes: doc.bytes.length,
      storedBytes: sealed.length,
      keyVersion: 1,
      originalPath: path,
      folderId: doc.folderId,
      tags: normaliseTags(doc.tags),
      uploadedBy: doc.by,
      createdAt: at(doc.days),
      takenAt: at(doc.days),
      contentMac: await contentMac(plain, key),
      status: "ready",
      deletedAt: null,
    });
  }
  files.files.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return files;
}
