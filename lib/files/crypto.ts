import { createHMAC, createSHA256 } from "hash-wasm";

/**
 * Encryption for the shared Gallery and Files (docs/plans/shared-files.md). Each Together has its own 32-byte key
 * (v1_files_keys); the browser encrypts every file with it before upload and decrypts after download, so Storage only
 * ever holds ciphertext. WebCrypto only, so it runs in the browser and in Node (tests).
 *
 * - Per-file key: HKDF-SHA256(Together key, salt = the file's id, info "together/file/v1") → AES-256-GCM.
 * - Format "TGF1": a 24-byte header, then the file in chunks (4 MiB by default), each sealed on its own.
 *     header: "TGF1" | format 1 | 0 | 0 0 | key version (u32) | chunk size (u32) | nonce prefix (8 random bytes)
 *     chunk i: AES-GCM(plaintext slice) with nonce = prefix ‖ i (u32) and AAD = file id ‖ i (u32) ‖ last (u8)
 *   The AAD stops chunks being reordered, moved to another file, or cut off at a chunk boundary. A big video is read
 *   and sealed a chunk at a time, and the format allows decrypting a range later (streaming playback).
 * - Duplicates: an HMAC-SHA256 of the plaintext under the Together's dedupe key (HKDF info "together/dedupe/v1"), so
 *   equal files match within a Together, and the database can't be used to test for a known file.
 */

export const CHUNK_SIZE = 4 * 1024 * 1024;
export const HEADER_BYTES = 24;
const TAG_BYTES = 16;
const FORMAT = 1;
const MAGIC = [0x54, 0x47, 0x46, 0x31]; // "TGF1"
const MAX_CHUNK = 64 * 1024 * 1024;

const text = new TextEncoder();
const FILE_INFO = text.encode("together/file/v1");
const DEDUPE_INFO = text.encode("together/dedupe/v1");

export class FileCryptoError extends Error {
  override name = "FileCryptoError";
}

/** one version of a Together's key, ready to use; the raw key isn't kept */
export interface TogetherKey {
  version: number;
  key: CryptoKey;
  /** the HMAC key for duplicate detection, derived from the Together key */
  dedupeKey: Uint8Array;
}

const subtle = () => globalThis.crypto.subtle;

function fromBase64(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function uuidBytes(id: string): Uint8Array<ArrayBuffer> {
  const hex = id.replace(/-/g, "");
  if (!/^[0-9a-f]{32}$/i.test(hex)) throw new FileCryptoError("A file id has to be a UUID.");
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

/** a key as v1_files_keys returns it (base64 of 32 bytes) */
export async function importTogetherKey(base64: string, version: number): Promise<TogetherKey> {
  const raw = fromBase64(base64);
  if (raw.length !== 32) throw new FileCryptoError("A Together key has to be 32 bytes.");
  const key = await subtle().importKey("raw", raw, "HKDF", false, ["deriveKey", "deriveBits"]);
  raw.fill(0);
  const bits = await subtle().deriveBits({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(32), info: DEDUPE_INFO }, key, 256);
  return { version, key, dedupeKey: new Uint8Array(bits) };
}

function fileKey(together: TogetherKey, fileId: Uint8Array<ArrayBuffer>) {
  return subtle().deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: fileId, info: FILE_INFO },
    together.key,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function nonce(prefix: Uint8Array, index: number) {
  const n = new Uint8Array(12);
  n.set(prefix, 0);
  new DataView(n.buffer).setUint32(8, index);
  return n;
}

function aad(fileId: Uint8Array, index: number, last: boolean) {
  const a = new Uint8Array(21);
  a.set(fileId, 0);
  new DataView(a.buffer).setUint32(16, index);
  a[20] = last ? 1 : 0;
  return a;
}

const chunkCount = (plainBytes: number, chunkSize: number) => Math.max(1, Math.ceil(plainBytes / chunkSize));

/** how big a file of this size is once encrypted (what the quota counts) */
export function encryptedSize(plainBytes: number, chunkSize = CHUNK_SIZE) {
  return HEADER_BYTES + chunkCount(plainBytes, chunkSize) * TAG_BYTES + plainBytes;
}

export interface FileHeader {
  keyVersion: number;
  chunkSize: number;
  noncePrefix: Uint8Array;
}

export function readHeader(bytes: Uint8Array): FileHeader {
  if (bytes.length < HEADER_BYTES || MAGIC.some((b, i) => bytes[i] !== b)) throw new FileCryptoError("This isn't an encrypted Together file.");
  if (bytes[4] !== FORMAT) throw new FileCryptoError(`This file uses format ${bytes[4]}, which this app doesn't know yet.`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, HEADER_BYTES);
  const chunkSize = view.getUint32(12);
  if (chunkSize < 1 || chunkSize > MAX_CHUNK) throw new FileCryptoError("This file's header is damaged.");
  return { keyVersion: view.getUint32(8), chunkSize, noncePrefix: bytes.slice(16, 24) };
}

function writeHeader(keyVersion: number, chunkSize: number, noncePrefix: Uint8Array) {
  const h = new Uint8Array(HEADER_BYTES);
  h.set(MAGIC, 0);
  h[4] = FORMAT;
  const view = new DataView(h.buffer);
  view.setUint32(8, keyVersion);
  view.setUint32(12, chunkSize);
  h.set(noncePrefix, 16);
  return h;
}

/** the encrypted file, a part at a time (header first), so a big file can be uploaded as it's sealed */
export async function* encryptParts(
  file: Blob,
  together: TogetherKey,
  fileId: string,
  chunkSize = CHUNK_SIZE,
): AsyncGenerator<Uint8Array<ArrayBuffer>> {
  if (chunkSize < 1 || chunkSize > MAX_CHUNK) throw new FileCryptoError("Bad chunk size.");
  const id = uuidBytes(fileId);
  const key = await fileKey(together, id);
  const prefix = globalThis.crypto.getRandomValues(new Uint8Array(8));
  yield writeHeader(together.version, chunkSize, prefix);
  const count = chunkCount(file.size, chunkSize);
  for (let i = 0; i < count; i++) {
    const plain = await file.slice(i * chunkSize, (i + 1) * chunkSize).arrayBuffer();
    const sealed = await subtle().encrypt({ name: "AES-GCM", iv: nonce(prefix, i), additionalData: aad(id, i, i === count - 1) }, key, plain);
    yield new Uint8Array(sealed);
  }
}

/** the whole encrypted file as a Blob */
export async function encryptFile(file: Blob, together: TogetherKey, fileId: string, chunkSize = CHUNK_SIZE): Promise<Blob> {
  const parts: Uint8Array<ArrayBuffer>[] = [];
  for await (const part of encryptParts(file, together, fileId, chunkSize)) parts.push(part);
  return new Blob(parts, { type: "application/octet-stream" });
}

/**
 * Decrypts a file. `keys` holds every version of the Together's key the app has (a file names the version that sealed
 * it). Anything changed, reordered, cut short or sealed for another file fails.
 */
export async function decryptFile(sealed: Blob, keys: ReadonlyMap<number, TogetherKey>, fileId: string, type = ""): Promise<Blob> {
  const header = readHeader(new Uint8Array(await sealed.slice(0, HEADER_BYTES).arrayBuffer()));
  const together = keys.get(header.keyVersion);
  if (!together) throw new FileCryptoError("This file was encrypted with a key this Together doesn't have.");
  const id = uuidBytes(fileId);
  const key = await fileKey(together, id);
  const stride = header.chunkSize + TAG_BYTES;
  const body = sealed.size - HEADER_BYTES;
  const count = Math.ceil(body / stride);
  if (count < 1 || body - (count - 1) * stride < TAG_BYTES) throw new FileCryptoError("This file is incomplete.");
  const parts: ArrayBuffer[] = [];
  for (let i = 0; i < count; i++) {
    const start = HEADER_BYTES + i * stride;
    const chunk = await sealed.slice(start, start + stride).arrayBuffer();
    try {
      parts.push(await subtle().decrypt({ name: "AES-GCM", iv: nonce(header.noncePrefix, i), additionalData: aad(id, i, i === count - 1) }, key, chunk));
    } catch {
      throw new FileCryptoError("This file is damaged or isn't this file.");
    }
  }
  return new Blob(parts, { type });
}

/** the duplicate fingerprint: HMAC-SHA256 of the plaintext under the Together's dedupe key, as 64 hex characters */
export async function contentMac(file: Blob, together: TogetherKey, chunkSize = CHUNK_SIZE): Promise<string> {
  const hmac = await createHMAC(createSHA256(), together.dedupeKey);
  hmac.init();
  for (let start = 0; start < file.size; start += chunkSize) {
    hmac.update(new Uint8Array(await file.slice(start, start + chunkSize).arrayBuffer()));
  }
  return hmac.digest("hex");
}
