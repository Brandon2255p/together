import { describe, expect, it } from "vitest";
import type { Place } from "@/lib/models";
import {
  applyFilter,
  areaLabel,
  distanceKm,
  filterLabel,
  filterOptions,
  groupByArea,
  narrowFilter,
  withParents,
  NO_AREA,
  NO_FILTER,
  sortPlaces,
  usualArea,
} from "./address";

function place(name: string, over: Partial<Place> = {}): Place {
  return {
    id: name,
    name,
    category: "Restaurant",
    area: "",
    street: "",
    note: "",
    city: "Cape Town",
    province: "Western Cape",
    country: "South Africa",
    mapsUrl: null,
    status: "been",
    ratings: {},
    visits: [],
    hue: "accent",
    googlePlaceId: null,
    location: null,
    ...over,
  };
}

const at = (lat: number, lng: number) => ({ lat, lng, fetchedAt: "2026-11-01T00:00:00Z" });

const places = [
  place("Nobu", { ratings: { a: 4, b: 5 }, location: at(-33.9075, 18.4167), visits: [{ id: "1", day: "2026-10-01", title: "x", note: null, rating: null }] }),
  place("Truth", { ratings: { a: 5 }, location: at(-33.9278, 18.4223), visits: [{ id: "2", day: "2026-11-01", title: "x", note: null, rating: null }] }),
  place("Delaire", { city: "Stellenbosch", ratings: { a: 3 }, location: at(-33.9196, 18.9234) }),
  place("Le Lude", { city: "Franschhoek", status: "want" }),
  place("Sandton", { city: "Johannesburg", province: "Gauteng", status: "want" }),
  place("Pastéis", { city: "Lisbon", province: "Lisbon", country: "Portugal", status: "want" }),
  place("Mom's", { city: "", province: "", country: "" }),
];

describe("areaLabel", () => {
  it("joins what we know with dots", () => {
    expect(areaLabel(places[0]!)).toBe("Cape Town · Western Cape · South Africa");
    expect(areaLabel({ city: "", province: " Gauteng ", country: "South Africa" })).toBe("Gauteng · South Africa");
    expect(areaLabel({ city: "", province: "", country: "" })).toBe("");
  });
});

describe("filterOptions", () => {
  it("counts every place, busiest first, and leaves out unknown areas", () => {
    const options = filterOptions(places, NO_FILTER);
    expect(options.countries).toEqual([
      { value: "South Africa", count: 5 },
      { value: "Portugal", count: 1 },
    ]);
    expect(options.provinces[0]).toEqual({ value: "Western Cape", count: 4 });
  });

  it("cascades: provinces within the country, cities within the province", () => {
    const options = filterOptions(places, { country: "South Africa", province: "Western Cape" });
    expect(options.provinces.map((o) => o.value)).toEqual(["Western Cape", "Gauteng"]);
    expect(options.cities).toEqual([
      { value: "Cape Town", count: 2 },
      { value: "Franschhoek", count: 1 },
      { value: "Stellenbosch", count: 1 },
    ]);
  });
});

describe("narrowFilter", () => {
  it("drops a province and city that aren't in the chosen country", () => {
    const filter = { ...NO_FILTER, country: "Portugal", province: "Western Cape", city: "Cape Town" };
    expect(narrowFilter(places, filter)).toEqual({ ...NO_FILTER, country: "Portugal" });
  });

  it("keeps choices that still fit", () => {
    const filter = { ...NO_FILTER, country: "South Africa", province: "Western Cape", city: "Cape Town" };
    expect(narrowFilter(places, filter)).toEqual(filter);
  });
});

describe("withParents", () => {
  it("fills in the province and country of a city chosen on its own", () => {
    expect(withParents(places, { ...NO_FILTER, city: "Lisbon" })).toEqual({ ...NO_FILTER, city: "Lisbon", province: "Lisbon", country: "Portugal" });
    expect(withParents(places, { ...NO_FILTER, province: "Gauteng" })).toEqual({ ...NO_FILTER, province: "Gauteng", country: "South Africa" });
  });

  it("leaves them when the city is in more than one", () => {
    const twice = [...places, place("Springfield", { city: "Springfield", province: "A" }), place("Other", { city: "Springfield", province: "B" })];
    expect(withParents(twice, { ...NO_FILTER, city: "Springfield" })).toEqual({ ...NO_FILTER, city: "Springfield" });
  });
});

describe("applyFilter and filterLabel", () => {
  it("keeps the places in the chosen area", () => {
    const filter = { ...NO_FILTER, province: "Western Cape" };
    expect(applyFilter(places, filter).map((p) => p.name)).toEqual(["Nobu", "Truth", "Delaire", "Le Lude"]);
    expect(applyFilter(places, NO_FILTER)).toHaveLength(places.length);
  });

  it("labels the chip with the narrowest choice", () => {
    expect(filterLabel({ ...NO_FILTER, country: "South Africa", city: "Cape Town" })).toBe("Cape Town");
    expect(filterLabel(NO_FILTER)).toBeNull();
  });
});

describe("sortPlaces", () => {
  const names = (ps: Place[]) => ps.map((p) => p.name);

  it("top rated: best average first, unrated last A to Z", () => {
    expect(names(sortPlaces(places, "top")).slice(0, 4)).toEqual(["Truth", "Nobu", "Delaire", "Le Lude"]);
  });

  it("recently visited: latest visit first, never visited last", () => {
    expect(names(sortPlaces(places, "recent")).slice(0, 3)).toEqual(["Truth", "Nobu", "Delaire"]);
  });

  it("nearest: by distance from here, places without coordinates last", () => {
    const stellenbosch = { lat: -33.93, lng: 18.86 };
    expect(names(sortPlaces(places, "nearest", stellenbosch)).slice(0, 3)).toEqual(["Delaire", "Truth", "Nobu"]);
    // without a location there's nothing to measure from: A to Z
    expect(names(sortPlaces(places, "nearest", null))[0]).toBe("Delaire");
  });

  it("A to Z ignores case and accents", () => {
    expect(names(sortPlaces(places, "az"))).toEqual(["Delaire", "Le Lude", "Mom's", "Nobu", "Pastéis", "Sandton", "Truth"]);
  });

  it("doesn't change the list it was given", () => {
    const before = names(places);
    sortPlaces(places, "az");
    expect(names(places)).toEqual(before);
  });
});

describe("groupByArea", () => {
  it("groups in order of each group's first place, with unknown areas last", () => {
    const groups = groupByArea(sortPlaces(places, "top"));
    expect(groups.map((g) => g.label)).toEqual([
      "Cape Town · Western Cape · South Africa",
      "Stellenbosch · Western Cape · South Africa",
      "Franschhoek · Western Cape · South Africa",
      "Lisbon · Lisbon · Portugal",
      "Johannesburg · Gauteng · South Africa",
      NO_AREA,
    ]);
    expect(groups[0]?.places.map((p) => p.name)).toEqual(["Truth", "Nobu"]);
  });
});

describe("distanceKm", () => {
  it("measures Cape Town to Stellenbosch at about 40 km as the crow flies", () => {
    expect(distanceKm({ lat: -33.9249, lng: 18.4241 }, { lat: -33.9321, lng: 18.8602 })).toBeCloseTo(40.3, 0);
  });
});

describe("usualArea", () => {
  it("is the middle of the places in the busiest city", () => {
    const point = usualArea(places);
    expect(point?.lat).toBeCloseTo((-33.9075 + -33.9278) / 2, 4);
  });

  it("is null when no place has coordinates", () => {
    expect(usualArea([place("x")])).toBeNull();
  });
});
