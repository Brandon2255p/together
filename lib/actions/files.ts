"use server";

import { serverBackend } from "@/lib/backend/server";
import type { FileKind, GalleryCursor, Hue, NewUpload } from "@/lib/models";

// Shared files. The bytes never come through here: the browser encrypts them and sends them to Storage with the
// signed upload startUpload returns.

const KINDS: FileKind[] = ["photo", "video", "document"];
const HUES: Hue[] = ["accent", "partner", "success", "warning"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAC = /^[0-9a-f]{64}$/;
const MAX_FILE_BYTES = 1024 ** 3;

const fileName = (name: string) => name.trim().replace(/[\u0000-\u001f]/g, "").slice(0, 200);
const folderName = (name: string) => name.trim().slice(0, 60);
const dimension = (n: number | null) => (n !== null && Number.isInteger(n) && n > 0 && n <= 100_000 ? n : null);

const cleanTags = (tags: string[]) => [...new Set(tags.map((t) => t.trim().toLowerCase()).filter((t) => t && t.length <= 30))].slice(0, 10);

export async function filesKeys() {
  return serverBackend.filesKeys();
}

export async function storageUsage() {
  return serverBackend.storageUsage();
}

export async function getDocuments() {
  return serverBackend.getDocuments();
}

/** a page of photos and videos, newest taken first; `before` is the last page's `next` */
export async function getGallery(before: GalleryCursor | null = null, limit = 60) {
  if (before && (!UUID.test(before.id) || Number.isNaN(Date.parse(before.takenAt)))) return { data: null, error: "That page doesn't look right." };
  return serverBackend.getGallery({ before, limit: Math.min(Math.max(Math.trunc(limit) || 60, 1), 120) });
}

export async function galleryMonths() {
  return serverBackend.galleryMonths();
}

export async function findDuplicates(macs: string[]) {
  const valid = [...new Set(macs.filter((m) => MAC.test(m)))].slice(0, 500);
  return serverBackend.findDuplicates({ macs: valid });
}

export async function startUpload(togetherId: string, upload: NewUpload) {
  const name = fileName(upload.name);
  if (!name) return { data: null, error: "That file has no name." };
  if (!UUID.test(upload.id) || !MAC.test(upload.contentMac) || !KINDS.includes(upload.kind)) return { data: null, error: "That upload doesn't look right." };
  if (upload.sizeBytes > MAX_FILE_BYTES) return { data: null, error: `${name} is over 1 GB, the most one file can be.` };
  const media = upload.kind !== "document";
  const part = (n: number | null) => n === null || (Number.isInteger(n) && n > 0);
  const thumbBytes = media ? upload.thumbBytes : null;
  const previewBytes = media ? upload.previewBytes : null;
  // each object is signed for exactly its size, so the declared total has to add up
  if (
    !(Number.isInteger(upload.originalBytes) && upload.originalBytes > 0) ||
    !part(thumbBytes) ||
    !part(previewBytes) ||
    upload.sizeBytes < 0 ||
    upload.storedBytes !== upload.originalBytes + (thumbBytes ?? 0) + (previewBytes ?? 0)
  )
    return { data: null, error: "That upload doesn't look right." };
  const takenAt = upload.takenAt && !Number.isNaN(Date.parse(upload.takenAt)) ? new Date(upload.takenAt).toISOString() : null;
  return serverBackend.startUpload({
    togetherId,
    ...upload,
    name,
    mimeType: upload.mimeType.slice(0, 200) || "application/octet-stream",
    // folders and tags are for documents; thumbs, previews and sizes for photos and videos
    folderId: media ? null : upload.folderId,
    tags: media ? [] : cleanTags(upload.tags),
    takenAt,
    thumbBytes,
    previewBytes,
    width: media ? dimension(upload.width) : null,
    height: media ? dimension(upload.height) : null,
    durationMs: upload.kind === "video" && upload.durationMs !== null && Number.isInteger(upload.durationMs) && upload.durationMs >= 0 ? upload.durationMs : null,
  });
}

export async function finishUpload(id: string) {
  return serverBackend.finishUpload({ id });
}

export async function abortUpload(id: string) {
  return serverBackend.abortUpload({ id });
}

export async function renameFile(id: string, name: string) {
  const clean = fileName(name);
  if (!clean) return { success: false, error: "Give it a name." };
  return serverBackend.renameFile({ id, name: clean });
}

export async function moveFile(id: string, folderId: string | null) {
  return serverBackend.moveFile({ id, folderId });
}

export async function setFileTags(id: string, tags: string[]) {
  const clean = cleanTags(tags);
  if (tags.length > 10) return { success: false, error: "A file can have up to 10 tags." };
  return serverBackend.setFileTags({ id, tags: clean });
}

export async function moveToBin(id: string) {
  return serverBackend.moveToBin({ id });
}

export async function restoreFile(id: string) {
  return serverBackend.restoreFile({ id });
}

export async function createFolder(name: string, hue: Hue) {
  const clean = folderName(name);
  if (!clean) return { data: null, error: "Give the folder a name." };
  return serverBackend.createFolder({ name: clean, hue: HUES.includes(hue) ? hue : "accent" });
}

export async function renameFolder(id: string, name: string) {
  const clean = folderName(name);
  if (!clean) return { success: false, error: "Give the folder a name." };
  return serverBackend.renameFolder({ id, name: clean });
}

export async function deleteFolder(id: string) {
  return serverBackend.deleteFolder({ id });
}

export async function signedFileUrls(paths: string[]) {
  return serverBackend.signedFileUrls({ paths: paths.slice(0, 100) });
}
