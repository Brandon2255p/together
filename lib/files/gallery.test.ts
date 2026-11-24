import { describe, expect, it } from "vitest";
import type { MonthCount, SharedFile } from "@/lib/models";
import {
  addedLine,
  addToMonths,
  durationLabel,
  exifTakenAt,
  filterGallery,
  groupByMonth,
  mediaKind,
  monthOf,
  monthSummary,
  positionLabel,
  removeFromMonths,
  scaledSize,
  takenLine,
  viewerDate,
} from "./gallery";

const people = [
  { id: "me", name: "Brandon" },
  { id: "adele", name: "Adele" },
];

type Item = Pick<SharedFile, "id" | "kind" | "name" | "uploadedBy" | "takenAt">;
const item = (id: string, takenAt: string, kind: "photo" | "video" = "photo", over: Partial<Item> = {}): Item => ({
  id,
  kind,
  name: `IMG_${id}.HEIC`,
  uploadedBy: "me",
  takenAt,
  ...over,
});

describe("mediaKind", () => {
  it("sorts photos and videos by MIME type, and HEIC or MOV by name when the type is blank", () => {
    expect(mediaKind("image/jpeg")).toBe("photo");
    expect(mediaKind("video/quicktime")).toBe("video");
    expect(mediaKind("", "IMG_1.HEIC")).toBe("photo");
    expect(mediaKind("", "clip.MOV")).toBe("video");
    expect(mediaKind("application/pdf", "a.pdf")).toBeNull();
  });
});

describe("months", () => {
  it("reads the month in the Together's time zone", () => {
    // 23:30 UTC on 31 Oct is already November in Johannesburg
    expect(monthOf("2026-10-31T23:30:00Z", "Africa/Johannesburg")).toEqual({ year: 2026, month: 11 });
    expect(monthOf("2026-10-31T23:30:00Z", "UTC")).toEqual({ year: 2026, month: 10 });
  });

  it("says what a month holds, for the chip that's on", () => {
    expect(monthSummary({ photos: 9, videos: 1 })).toBe("9 photos · 1 video");
    expect(monthSummary({ photos: 1, videos: 0 })).toBe("1 photo");
    expect(monthSummary({ photos: 9, videos: 2 }, "video")).toBe("2 videos");
    expect(monthSummary({ photos: 0, videos: 2 }, "photo")).toBe("Nothing yet");
  });

  it("groups newest first, with the whole month's counts", () => {
    const items = [item("a", "2026-11-12T16:42:00Z"), item("b", "2026-11-02T08:00:00Z", "video"), item("c", "2026-10-20T08:00:00Z")];
    const months: MonthCount[] = [
      { year: 2026, month: 11, photos: 9, videos: 1 },
      { year: 2026, month: 10, photos: 23, videos: 0 },
    ];
    const groups = groupByMonth(items, months);
    expect(groups.map((g) => [g.title, g.summary, g.items.map((i) => i.id)])).toEqual([
      ["November 2026", "9 photos · 1 video", ["a", "b"]],
      ["October 2026", "23 photos", ["c"]],
    ]);
  });

  it("counts what's loaded for a month the counts don't know yet", () => {
    const groups = groupByMonth([item("a", "2026-12-01T10:00:00Z"), item("b", "2026-12-01T09:00:00Z", "video")], []);
    expect(groups[0]!.summary).toBe("1 photo · 1 video");
  });

  it("adds uploads to the counts and takes binned items off", () => {
    const months: MonthCount[] = [{ year: 2026, month: 10, photos: 2, videos: 0 }];
    const added = addToMonths(months, [item("a", "2026-11-12T16:42:00Z"), item("b", "2026-10-02T08:00:00Z", "video")]);
    expect(added).toEqual([
      { year: 2026, month: 11, photos: 1, videos: 0 },
      { year: 2026, month: 10, photos: 2, videos: 1 },
    ]);
    expect(removeFromMonths(added, item("x", "2026-10-02T08:00:00Z"))).toContainEqual({ year: 2026, month: 10, photos: 1, videos: 1 });
  });
});

describe("labels", () => {
  it("shows a video's length", () => {
    expect(durationLabel(42_000)).toBe("0:42");
    expect(durationLabel(725_400)).toBe("12:05");
    expect(durationLabel(3_723_000)).toBe("1:02:03");
  });

  it("dates the viewer in the Together's time zone", () => {
    expect(viewerDate("2026-11-12T16:42:00Z")).toBe("Thu 12 Nov 2026");
    expect(takenLine("2026-11-12T16:42:00Z")).toBe("Taken Thu 12 Nov 2026, 18:42");
  });

  it("says where an item sits in its month", () => {
    const shown = [item("a", "2026-11-12T16:42:00Z"), item("b", "2026-11-10T08:00:00Z"), item("c", "2026-11-02T08:00:00Z"), item("d", "2026-10-02T08:00:00Z")];
    expect(positionLabel(shown[1]!, shown)).toBe("2 of 3 · November");
    expect(positionLabel(shown[3]!, shown)).toBe("1 of 1 · October");
  });

  it("says who added it and when", () => {
    expect(addedLine({ uploadedBy: "adele", createdAt: "2026-11-13T08:00:00Z" }, people, "me")).toBe("Adele added this · 13 Nov");
    expect(addedLine({ uploadedBy: "me", createdAt: "2026-11-13T08:00:00Z" }, people, "me")).toBe("You added this · 13 Nov");
  });
});

describe("filterGallery", () => {
  const items = [item("1", "2026-11-12T16:42:00Z"), item("2", "2026-11-10T08:00:00Z", "video", { uploadedBy: "adele", name: "Beach.mov" })];

  it("keeps the chip's kind", () => {
    expect(filterGallery(items, { filter: "video", query: "", people, meId: "me" }).map((i) => i.id)).toEqual(["2"]);
  });

  it("matches every word against the name and who added it", () => {
    expect(filterGallery(items, { filter: "all", query: "adele beach", people, meId: "me" }).map((i) => i.id)).toEqual(["2"]);
    expect(filterGallery(items, { filter: "all", query: "img", people, meId: "me" }).map((i) => i.id)).toEqual(["1"]);
  });
});

describe("scaledSize", () => {
  it("fits a thumb's shorter side and a preview's longer side, never enlarging", () => {
    expect(scaledSize(4032, 3024, 400, "short")).toEqual({ width: 533, height: 400 });
    expect(scaledSize(4032, 3024, 1600, "long")).toEqual({ width: 1600, height: 1200 });
    expect(scaledSize(300, 200, 400, "short")).toEqual({ width: 300, height: 200 });
  });
});

describe("exifTakenAt", () => {
  it("uses the EXIF offset when there is one", () => {
    expect(exifTakenAt("2026:11:12 18:42:10", "+02:00")).toBe("2026-11-12T16:42:10.000Z");
    expect(exifTakenAt("2026:07:04 09:00:00", "-04:00")).toBe("2026-07-04T13:00:00.000Z");
  });

  it("reads the clock time in the Together's time zone without one", () => {
    expect(exifTakenAt("2026:11:12 18:42:10", undefined, "Africa/Johannesburg")).toBe("2026-11-12T16:42:10.000Z");
    expect(exifTakenAt("2026:01:12 18:42:10", null, "Europe/London")).toBe("2026-01-12T18:42:10.000Z");
  });

  it("ignores missing or nonsense dates", () => {
    expect(exifTakenAt(undefined, undefined)).toBeNull();
    expect(exifTakenAt("0000:00:00 00:00:00", undefined)).toBeNull();
    expect(exifTakenAt("yesterday", undefined)).toBeNull();
  });
});
