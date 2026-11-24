import { describe, expect, it } from "vitest";
import { fileIdOf, ORPHAN_GRACE_MS, orphanedObjects } from "./storage";

const T = "11111111-1111-4111-8111-111111111111";
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const now = new Date("2026-11-24T12:00:00Z");
const old = new Date(now.getTime() - ORPHAN_GRACE_MS - 1);
const fresh = new Date(now.getTime() - 60_000);

describe("fileIdOf", () => {
  it("reads the file id from each of a file's objects", () => {
    expect(fileIdOf(`${T}/${A}/original.bin`)).toBe(A);
    expect(fileIdOf(`${T}/${A}/thumb.bin`)).toBe(A);
    expect(fileIdOf(`${T}/${A}/preview.bin`)).toBe(A);
  });
  it("is null for anything else", () => {
    expect(fileIdOf(`${T}/${A}/other.bin`)).toBeNull();
    expect(fileIdOf(`${A}/original.bin`)).toBeNull();
    expect(fileIdOf("notes.txt")).toBeNull();
  });
});

describe("orphanedObjects", () => {
  it("keeps objects whose file has a row", () => {
    expect(orphanedObjects([{ path: `${T}/${A}/original.bin`, modifiedAt: old }], new Set([A]), now)).toEqual([]);
  });
  it("picks objects with no row once they're past the grace period", () => {
    const objects = [
      { path: `${T}/${B}/original.bin`, modifiedAt: old },
      { path: `${T}/${B}/thumb.bin`, modifiedAt: old },
      { path: `${T}/${A}/original.bin`, modifiedAt: old },
    ];
    expect(orphanedObjects(objects, new Set([A]), now)).toEqual([`${T}/${B}/original.bin`, `${T}/${B}/thumb.bin`]);
  });
  it("leaves new objects alone: their upload may still be finishing", () => {
    expect(orphanedObjects([{ path: `${T}/${B}/original.bin`, modifiedAt: fresh }], new Set(), now)).toEqual([]);
  });
  it("picks stray objects that aren't the app's", () => {
    expect(orphanedObjects([{ path: "stray.txt", modifiedAt: old }], new Set(), now)).toEqual(["stray.txt"]);
  });
});
