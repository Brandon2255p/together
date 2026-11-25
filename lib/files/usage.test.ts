import { describe, expect, it } from "vitest";
import { usageView } from "./usage";

const GB = 1024 ** 3;

describe("usageView", () => {
  const usage = {
    quotaBytes: 50 * GB,
    usedBytes: 31.6 * GB,
    photos: { count: 1204, bytes: 12.1 * GB },
    videos: { count: 38, bytes: 16.4 * GB },
    documents: { count: 1, bytes: 2.6 * GB },
    bin: { count: 0, bytes: 0 },
  };

  it("says how much is used and left", () => {
    const view = usageView(usage);
    expect(view.headline).toBe("31.6 GB of 50 GB");
    expect(view.left).toBe("18.4 GB left. Everyone in the Together shares this space.");
    expect(view.used).toBeCloseTo(0.632);
  });

  it("gives a row and a bar share for each part", () => {
    const parts = usageView(usage).parts;
    expect(parts.map((p) => [p.label, p.count, p.size])).toEqual([
      ["Photos", "1,204 photos", "12.1 GB"],
      ["Videos", "38 videos", "16.4 GB"],
      ["Files", "1 file", "2.6 GB"],
      ["Bin", "0 items", "0 KB"],
    ]);
    expect(parts[0]!.fraction).toBeCloseTo(0.242);
  });

  it("explains the bin only when something's in it, and says when it's full", () => {
    expect(usageView(usage).binNote).toBeNull();
    const full = usageView({ ...usage, usedBytes: 50 * GB, bin: { count: 3, bytes: GB } });
    expect(full.binNote).toMatch(/still count/);
    expect(full.left).toMatch(/^No space left/);
  });
});
