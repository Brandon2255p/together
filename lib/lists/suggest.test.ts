import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "@/lib/models";
import { splitMatch, suggestItems } from "./suggest";

const catalog: CatalogEntry[] = [
  { name: "Milk", timesAdded: 12, popular: true },
  { name: "Mince", timesAdded: 0, popular: true },
  { name: "Mint", timesAdded: 0, popular: false },
  { name: "Mineral water", timesAdded: 0, popular: false },
  { name: "Oat milk", timesAdded: 9, popular: true },
  { name: "Mozzarella", timesAdded: 1, popular: false },
];

describe("suggestItems", () => {
  it("puts usual items, then popular, then the rest", () => {
    expect(suggestItems("mi", catalog, [])).toEqual([
      { name: "Milk", reason: "usual" },
      { name: "Mince", reason: "popular" },
      { name: "Mineral water", reason: null },
      { name: "Mint", reason: null },
    ]);
  });

  it("ranks prefix matches above word matches", () => {
    const names = suggestItems("mil", catalog, [], 10).map((s) => s.name);
    expect(names).toEqual(["Milk", "Oat milk"]);
  });

  it("skips what's already on the list, ignoring case", () => {
    expect(suggestItems("mi", catalog, ["milk"]).map((s) => s.name)).not.toContain("Milk");
  });

  it("returns nothing for a blank query", () => {
    expect(suggestItems("  ", catalog, [])).toEqual([]);
  });
});

describe("splitMatch", () => {
  it("splits around the match", () => {
    expect(splitMatch("Oat milk", "mi")).toEqual(["Oat ", "mi", "lk"]);
    expect(splitMatch("Bread", "mi")).toEqual(["Bread", "", ""]);
  });
});
