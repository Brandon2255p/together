import { describe, expect, it } from "vitest";
import { highlightParts, hoursLabel, looksLikeLink, priceLabel } from "./preview";

describe("highlightParts", () => {
  it("marks the matched text", () => {
    expect(highlightParts("Kloof Street House", [[0, 9]])).toEqual([
      { text: "Kloof Str", match: true },
      { text: "eet House", match: false },
    ]);
  });

  it("handles several matches in any order", () => {
    expect(highlightParts("Truth Coffee Roasting", [[13, 16], [0, 5]]).map((p) => p.match)).toEqual([true, false, true, false]);
  });

  it("ignores offsets past the end or overlapping", () => {
    expect(highlightParts("Nobu", [[0, 2], [1, 3], [10, 12]])).toEqual([
      { text: "No", match: true },
      { text: "b", match: true },
      { text: "u", match: false },
    ]);
    expect(highlightParts("Nobu", [])).toEqual([{ text: "Nobu", match: false }]);
  });
});

describe("priceLabel", () => {
  it("shows rands per level", () => {
    expect(priceLabel(3)).toBe("R R R");
    expect(priceLabel(0)).toBe("Free");
    expect(priceLabel(null)).toBeNull();
    expect(priceLabel(7)).toBeNull();
  });
});

describe("hoursLabel", () => {
  it("says until when it's open, or that it's closed", () => {
    expect(hoursLabel({ openNow: true, closesAt: "22:00" })).toEqual({ text: "Open until 22:00", open: true });
    expect(hoursLabel({ openNow: true, closesAt: null })).toEqual({ text: "Open now", open: true });
    expect(hoursLabel({ openNow: false, closesAt: null })).toEqual({ text: "Closed now", open: false });
    expect(hoursLabel({ openNow: null, closesAt: null })).toBeNull();
    expect(hoursLabel(null)).toBeNull();
  });
});

describe("looksLikeLink", () => {
  it("spots links in shared text", () => {
    expect(looksLikeLink("Nobu https://maps.app.goo.gl/abc")).toBe(true);
    expect(looksLikeLink("Kloof Str")).toBe(false);
  });
});
