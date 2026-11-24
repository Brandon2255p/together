import { describe, expect, it } from "vitest";
import type { SharedFile } from "@/lib/models";
import {
  addedByName,
  fileMeta,
  filterDocuments,
  folderCounts,
  formatBytes,
  normaliseTags,
  spaceCheck,
  tagLabel,
  topTags,
  typeLabel,
  typeTone,
  uploadSummary,
} from "./documents";

const people = [
  { id: "me", name: "Brandon" },
  { id: "adele", name: "Adele" },
];

const file = (over: Partial<SharedFile>): SharedFile => ({
  id: "f",
  kind: "document",
  name: "Passport — Brandon.pdf",
  mimeType: "application/pdf",
  sizeBytes: 1_258_291,
  storedBytes: 1_258_331,
  keyVersion: 1,
  originalPath: "t/f/original.bin",
  folderId: null,
  tags: [],
  uploadedBy: "adele",
  createdAt: "2026-11-04T08:00:00Z",
  takenAt: "2026-11-04T08:00:00Z",
  ...over,
});

describe("type labels", () => {
  it("comes from the extension, else the MIME type", () => {
    expect(typeLabel("Passport.pdf", "application/pdf")).toBe("PDF");
    expect(typeLabel("disc.jpeg", "image/jpeg")).toBe("JPG");
    expect(typeLabel("notes", "text/plain")).toBe("TXT");
    expect(typeLabel("scan", "image/heic")).toBe("HEIC");
    expect(typeLabel("blob", "application/vnd.openxmlformats-officedocument")).toBe("FILE");
  });

  it("colours documents, images and sheets", () => {
    expect(typeTone("a.pdf", "application/pdf")).toBe("accent");
    expect(typeTone("a.jpg", "image/jpeg")).toBe("partner");
    expect(typeTone("a.xlsx", "")).toBe("success");
    expect(typeTone("a.docx", "")).toBe("warning");
  });
});

describe("sizes", () => {
  it("reads like the design", () => {
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(840 * 1024)).toBe("840 KB");
    expect(formatBytes(1.2 * 1024 ** 2)).toBe("1.2 MB");
    expect(formatBytes(2 * 1024 ** 2)).toBe("2 MB");
    expect(formatBytes(31.6 * 1024 ** 3)).toBe("32 GB");
    expect(formatBytes(50 * 1024 ** 3)).toBe("50 GB");
  });
});

describe("who added it", () => {
  it("says You, the name, or Someone", () => {
    expect(addedByName("me", people, "me")).toBe("You");
    expect(addedByName("adele", people, "me")).toBe("Adele");
    expect(addedByName(null, people, "me")).toBe("Someone");
    expect(addedByName("gone", people, "me")).toBe("Someone");
  });

  it("makes the row's meta line in the Together's time zone", () => {
    expect(fileMeta(file({ createdAt: "2026-11-03T23:30:00Z" }), people, "me")).toBe("Adele · 4 Nov 2026 · 1.2 MB");
    expect(fileMeta(file({ createdAt: "2026-09-12T10:00:00Z" }), people, "me")).toBe("Adele · 12 Sep 2026 · 1.2 MB");
  });
});

describe("folders and tags", () => {
  const files = [
    file({ id: "1", folderId: "car", tags: ["car"] }),
    file({ id: "2", folderId: "car", tags: ["car", "insurance"] }),
    file({ id: "3", folderId: "ids", tags: ["id", "passport"] }),
  ];

  it("counts files per folder", () => {
    expect(folderCounts(files)).toEqual({ car: 2, ids: 1 });
  });

  it("puts the most used tags first", () => {
    expect(topTags(files)).toEqual(["car", "id", "insurance", "passport"]);
    expect(topTags(files, 2)).toEqual(["car", "id"]);
  });

  it("labels and normalises tags", () => {
    expect(tagLabel("id")).toBe("ID");
    expect(tagLabel("passport")).toBe("Passport");
    expect(tagLabel("car")).toBe("Car");
    expect(normaliseTags([" Car ", "car", "", "ID"])).toEqual(["car", "id"]);
  });
});

describe("filtering", () => {
  const folders = [{ id: "car", name: "Car", hue: "partner" as const }];
  const files = [
    file({ id: "1", name: "Licence disc.jpg", folderId: "car", tags: ["car"], uploadedBy: "me" }),
    file({ id: "2", name: "Passport — Brandon.pdf", tags: ["passport", "id"] }),
  ];
  const run = (query: string, tag: string | null = null) => filterDocuments(files, { query, tag, folders, people, meId: "me" }).map((f) => f.id);

  it("matches every word against the name, tags, folder and who added it", () => {
    expect(run("")).toEqual(["1", "2"]);
    expect(run("passport")).toEqual(["2"]);
    expect(run("car")).toEqual(["1"]);
    expect(run("adele id")).toEqual(["2"]);
    expect(run("you disc")).toEqual(["1"]);
    expect(run("adele car")).toEqual([]);
  });

  it("narrows to a tag", () => {
    expect(run("", "id")).toEqual(["2"]);
    expect(run("licence", "id")).toEqual([]);
  });
});

describe("the space check", () => {
  const GB = 1024 ** 3;

  it("lets files through that fit", () => {
    expect(spaceCheck({ quotaBytes: 50 * GB, usedBytes: 10 * GB }, [GB, GB])).toEqual({ fits: true });
  });

  it("says what's needed and what's left when they don't", () => {
    const result = spaceCheck({ quotaBytes: 50 * GB, usedBytes: 49.2 * GB }, [0.7 * GB, 0.5 * GB]);
    expect(result).toEqual({ fits: false, message: "Not enough space: these need 1.2 GB and 819 MB is left. Empty the bin or remove something first." });
  });

  it("never says less than nothing is left", () => {
    const result = spaceCheck({ quotaBytes: GB, usedBytes: 2 * GB }, [1024]);
    expect(result.fits).toBe(false);
    expect(!result.fits && result.message).toContain("this needs 1 KB and 0 B is left");
  });
});

it("sums up an upload", () => {
  expect(uploadSummary(3, 1)).toEqual({ title: "3 files added", overline: "Upload done · 1 skipped" });
  expect(uploadSummary(1, 0)).toEqual({ title: "1 file added", overline: "Upload done" });
  expect(uploadSummary(0, 2)).toEqual({ title: "Nothing new added", overline: "Upload done · 2 skipped" });
});
