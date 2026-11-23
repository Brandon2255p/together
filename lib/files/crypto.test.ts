import { createHmac, hkdfSync, randomBytes, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { contentMac, decryptFile, encryptFile, encryptedSize, HEADER_BYTES, importTogetherKey, readHeader, type TogetherKey } from "./crypto";

const rawKey = () => randomBytes(32).toString("base64");
const bytes = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer());
const keyring = (...keys: TogetherKey[]) => new Map(keys.map((k) => [k.version, k]));

describe("file encryption", async () => {
  const keyA = await importTogetherKey(rawKey(), 1);
  const keyB = await importTogetherKey(rawKey(), 1);
  const plain = new Blob([randomBytes(100)]);
  const id = randomUUID();

  it("round-trips files of every shape", async () => {
    for (const [size, chunk] of [[0, 16], [1, 16], [15, 16], [16, 16], [17, 16], [100, 16], [100, 4 * 1024 * 1024]] as const) {
      const original = new Blob([randomBytes(size)]);
      const sealed = await encryptFile(original, keyA, id, chunk);
      expect(sealed.size, `size ${size}/${chunk}`).toBe(encryptedSize(size, chunk));
      expect(await bytes(await decryptFile(sealed, keyring(keyA), id))).toEqual(await bytes(original));
    }
  });

  it("hides the content, and seals the same file differently each time", async () => {
    const secret = new Blob(["passport number A12345678"]);
    const one = await encryptFile(secret, keyA, id);
    const two = await encryptFile(secret, keyA, id);
    expect(new TextDecoder().decode(await bytes(one))).not.toContain("A12345678");
    expect(await bytes(one)).not.toEqual(await bytes(two));
  });

  it("writes the key version and chunk size in the header", async () => {
    const v3 = await importTogetherKey(rawKey(), 3);
    const header = readHeader(await bytes(await encryptFile(plain, v3, id, 32)));
    expect(header).toMatchObject({ keyVersion: 3, chunkSize: 32 });
  });

  it("opens files sealed with an older key version", async () => {
    const v1 = await importTogetherKey(rawKey(), 1);
    const v2 = await importTogetherKey(rawKey(), 2);
    const old = await encryptFile(plain, v1, id);
    expect(await bytes(await decryptFile(old, keyring(v1, v2), id))).toEqual(await bytes(plain));
    await expect(decryptFile(old, keyring(v2), id)).rejects.toThrow(/key this Together doesn't have/);
  });

  it("refuses another Together's key", async () => {
    const sealed = await encryptFile(plain, keyA, id);
    await expect(decryptFile(sealed, keyring(keyB), id)).rejects.toThrow(/damaged/);
  });

  it("refuses a file presented as another file", async () => {
    const sealed = await encryptFile(plain, keyA, id);
    await expect(decryptFile(sealed, keyring(keyA), randomUUID())).rejects.toThrow(/damaged/);
  });

  it("refuses a changed byte", async () => {
    const sealed = await bytes(await encryptFile(plain, keyA, id));
    sealed.set([sealed.at(HEADER_BYTES + 5)! ^ 1], HEADER_BYTES + 5);
    await expect(decryptFile(new Blob([sealed]), keyring(keyA), id)).rejects.toThrow(/damaged/);
  });

  it("refuses a file cut short at a chunk boundary", async () => {
    const sealed = await bytes(await encryptFile(plain, keyA, id, 16)); // 7 chunks of 32 sealed bytes, the last 4+16
    const withoutLast = sealed.slice(0, HEADER_BYTES + 6 * 32);
    await expect(decryptFile(new Blob([withoutLast]), keyring(keyA), id)).rejects.toThrow(/damaged/);
    await expect(decryptFile(new Blob([sealed.slice(0, HEADER_BYTES)]), keyring(keyA), id)).rejects.toThrow(/incomplete/);
  });

  it("refuses reordered chunks", async () => {
    const sealed = await bytes(await encryptFile(plain, keyA, id, 16));
    const first = sealed.slice(HEADER_BYTES, HEADER_BYTES + 32);
    const second = sealed.slice(HEADER_BYTES + 32, HEADER_BYTES + 64);
    const swapped = new Blob([sealed.slice(0, HEADER_BYTES), second, first, sealed.slice(HEADER_BYTES + 64)]);
    await expect(decryptFile(swapped, keyring(keyA), id)).rejects.toThrow(/damaged/);
  });

  it("refuses things that aren't Together files", async () => {
    await expect(decryptFile(new Blob(["hello, this is a plain text file"]), keyring(keyA), id)).rejects.toThrow(/isn't an encrypted Together file/);
    const future = await bytes(await encryptFile(plain, keyA, id));
    future[4] = 9;
    expect(() => readHeader(future)).toThrow(/format 9/);
  });

  it("only takes 32-byte keys", async () => {
    await expect(importTogetherKey(randomBytes(16).toString("base64"), 1)).rejects.toThrow(/32 bytes/);
  });
});

describe("content MAC", async () => {
  const raw = rawKey();
  const key = await importTogetherKey(raw, 1);
  const other = await importTogetherKey(rawKey(), 1);
  const file = new Blob([randomBytes(1000)]);

  it("is HMAC-SHA256 under the HKDF dedupe key", async () => {
    const dedupe = Buffer.from(hkdfSync("sha256", Buffer.from(raw, "base64"), Buffer.alloc(32), "together/dedupe/v1", 32));
    const expected = createHmac("sha256", dedupe).update(await bytes(file)).digest("hex");
    expect(await contentMac(file, key, 64)).toBe(expected);
  });

  it("matches equal files in a Together, and only there", async () => {
    const copy = new Blob([await file.arrayBuffer()]);
    expect(await contentMac(copy, key)).toBe(await contentMac(file, key));
    expect(await contentMac(file, other)).not.toBe(await contentMac(file, key));
    expect(await contentMac(new Blob([randomBytes(1000)]), key)).not.toBe(await contentMac(file, key));
  });
});
