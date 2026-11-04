import { describe, expect, it } from "vitest";
import { addressFromComponents, closingTime, kindFromGoogleType } from "./google-types";

describe("kindFromGoogleType", () => {
  it("maps Google's types to our kinds", () => {
    expect(kindFromGoogleType("restaurant")).toBe("Restaurant");
    expect(kindFromGoogleType("japanese_restaurant")).toBe("Restaurant");
    expect(kindFromGoogleType("coffee_shop")).toBe("Café");
    expect(kindFromGoogleType("cafe")).toBe("Café");
    expect(kindFromGoogleType("wine_bar")).toBe("Bar");
    expect(kindFromGoogleType("bakery")).toBe("Bakery");
    expect(kindFromGoogleType("hiking_area")).toBe("Hike");
    expect(kindFromGoogleType("park")).toBe("Hike");
  });

  it("calls everything else Other", () => {
    expect(kindFromGoogleType("shopping_mall")).toBe("Other");
    expect(kindFromGoogleType(null)).toBe("Other");
  });
});

describe("addressFromComponents", () => {
  it("splits Google's address into street, area, city, province and country", () => {
    expect(
      addressFromComponents([
        { longText: "21", types: ["street_number"] },
        { longText: "Beach Road", types: ["route"] },
        { longText: "Sea Point", types: ["sublocality_level_1", "sublocality", "political"] },
        { longText: "Cape Town", types: ["locality", "political"] },
        { longText: "Western Cape", shortText: "WC", types: ["administrative_area_level_1", "political"] },
        { longText: "South Africa", shortText: "ZA", types: ["country", "political"] },
        { longText: "8005", types: ["postal_code"] },
      ]),
    ).toEqual({ street: "21 Beach Road", area: "Sea Point", city: "Cape Town", province: "Western Cape", country: "South Africa" });
  });

  it("uses the postal town when there's no locality, and the neighbourhood when there's no sublocality", () => {
    const address = addressFromComponents([
      { longText: "Shoreditch", types: ["neighborhood"] },
      { longText: "London", types: ["postal_town"] },
      { longText: "England", types: ["administrative_area_level_1"] },
    ]);
    expect(address).toMatchObject({ area: "Shoreditch", city: "London", province: "England", street: "", country: "" });
  });

  it("copes with no components", () => {
    expect(addressFromComponents(undefined)).toEqual({ street: "", area: "", city: "", province: "", country: "" });
  });
});

describe("closingTime", () => {
  const now = new Date("2026-11-04T16:00:00Z");

  it("gives the closing time in the place's own time", () => {
    // 20:00 UTC is 22:00 in South Africa (UTC+2)
    expect(closingTime("2026-11-04T20:00:00Z", 120, now)).toBe("22:00");
  });

  it("is null without hours, or when it doesn't close within a day", () => {
    expect(closingTime(undefined, 120, now)).toBeNull();
    expect(closingTime("2026-11-04T20:00:00Z", undefined, now)).toBeNull();
    expect(closingTime("2026-11-07T20:00:00Z", 120, now)).toBeNull();
  });
});
