import type { Coordinates, Place, PlaceFilter, PlaceSort } from "@/lib/models";

// Shaping a Together's places for the Places list (screens 19 and 20): the area label, the cascading filter options
// with counts, filtering, sorting (including by distance) and grouping by City · Province · Country.

export const NO_FILTER: PlaceFilter = { country: "", province: "", city: "", sort: "top" };

export const SORT_LABELS: Record<PlaceSort, string> = {
  top: "Top rated",
  recent: "Recently visited",
  nearest: "Nearest first",
  az: "A to Z",
};

/** "Cape Town · Western Cape · South Africa", skipping parts we don't know; "" when we know none */
export function areaLabel(place: Pick<Place, "city" | "province" | "country">): string {
  return [place.city, place.province, place.country]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" · ");
}

/** the average of everyone's ratings, or null when nobody has rated it */
export function averageRating(place: Pick<Place, "ratings">): number | null {
  const values = Object.values(place.ratings).filter((v): v is number => typeof v === "number");
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

/** the day of the latest visit, or "" */
export function lastVisited(place: Pick<Place, "visits">): string {
  return place.visits.reduce((latest, v) => (v.day > latest ? v.day : latest), "");
}

export interface FilterOption {
  value: string;
  count: number;
}

export interface FilterOptions {
  countries: FilterOption[];
  provinces: FilterOption[];
  cities: FilterOption[];
}

function countBy(places: Place[], key: "country" | "province" | "city"): FilterOption[] {
  const counts = new Map<string, number>();
  for (const place of places) {
    const value = place[key].trim();
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

const matches = (place: Place, key: "country" | "province" | "city", value: string) => !value || place[key].trim() === value;

/**
 * The choices in the filter sheet, each with how many places it has. They cascade: provinces are counted within the
 * chosen country, cities within the chosen country and province.
 */
export function filterOptions(places: Place[], filter: Pick<PlaceFilter, "country" | "province">): FilterOptions {
  const inCountry = places.filter((p) => matches(p, "country", filter.country));
  const inProvince = inCountry.filter((p) => matches(p, "province", filter.province));
  return {
    countries: countBy(places, "country"),
    provinces: countBy(inCountry, "province"),
    cities: countBy(inProvince, "city"),
  };
}

/**
 * Picking a country or province drops the narrower choices that aren't in it, so the filter never asks for a city in
 * another country.
 */
export function narrowFilter(places: Place[], filter: PlaceFilter): PlaceFilter {
  const options = filterOptions(places, filter);
  const province = options.provinces.some((o) => o.value === filter.province) ? filter.province : "";
  const cities = filterOptions(places, { country: filter.country, province }).cities;
  const city = cities.some((o) => o.value === filter.city) ? filter.city : "";
  return { ...filter, province, city };
}

/**
 * Choosing a city (or province) on its own also chooses where it is, so the wider choices narrow to match. Only when
 * it's unambiguous: a city name in two provinces leaves them as they are.
 */
export function withParents(places: Place[], filter: PlaceFilter): PlaceFilter {
  const only = (level: "province" | "country", child: "city" | "province", value: string) => {
    if (!value) return "";
    const parents = new Set(places.filter((p) => p[child].trim() === value).map((p) => p[level].trim()));
    return parents.size === 1 ? ([...parents][0] ?? "") : "";
  };
  const province = filter.province || only("province", "city", filter.city);
  const country = filter.country || only("country", "province", province);
  return { ...filter, province, country };
}

export function applyFilter(places: Place[], filter: PlaceFilter): Place[] {
  return places.filter(
    (p) => matches(p, "country", filter.country) && matches(p, "province", filter.province) && matches(p, "city", filter.city),
  );
}

/** whether any of country, province and city is set */
export const isFiltered = (filter: PlaceFilter) => Boolean(filter.country || filter.province || filter.city);

/** the narrowest part of the filter, for its chip: the city, else the province, else the country */
export function filterLabel(filter: PlaceFilter): string | null {
  return filter.city || filter.province || filter.country || null;
}

const EARTH_RADIUS_KM = 6371;
const radians = (degrees: number) => (degrees * Math.PI) / 180;

/** the great-circle distance in km (haversine) */
export function distanceKm(a: Coordinates, b: Coordinates): number {
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

const byName = (a: Place, b: Place) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

/** nulls (unrated, never visited, no coordinates) go last; ties go A to Z */
function nullsLast<T>(value: (p: Place) => T | null, compare: (a: T, b: T) => number) {
  return (a: Place, b: Place) => {
    const va = value(a);
    const vb = value(b);
    if (va === null && vb === null) return byName(a, b);
    if (va === null) return 1;
    if (vb === null) return -1;
    return compare(va, vb) || byName(a, b);
  };
}

/**
 * Sorts a copy. Nearest needs `here` (the device's location); without it, or for places without stored coordinates,
 * those places go last.
 */
export function sortPlaces(places: Place[], sort: PlaceSort, here: Coordinates | null = null): Place[] {
  const sorted = [...places];
  switch (sort) {
    case "top":
      return sorted.sort(nullsLast(averageRating, (a, b) => b - a));
    case "recent":
      return sorted.sort(nullsLast((p) => lastVisited(p) || null, (a, b) => b.localeCompare(a)));
    case "nearest":
      return sorted.sort(nullsLast((p) => (here && p.location ? distanceKm(here, p.location) : null), (a, b) => a - b));
    case "az":
      return sorted.sort(byName);
  }
}

export interface AreaGroup<T> {
  /** "Cape Town · Western Cape · South Africa", or "Somewhere else" for places without an area */
  label: string;
  places: T[];
}

export const NO_AREA = "Somewhere else";

/**
 * Groups places by City · Province · Country, keeping their order: groups come in the order of their first place, so
 * the best (or nearest, or first A to Z) group leads. Places without any area go last.
 */
export function groupByArea<T extends Pick<Place, "city" | "province" | "country">>(places: T[]): AreaGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const place of places) {
    const label = areaLabel(place) || NO_AREA;
    groups.set(label, [...(groups.get(label) ?? []), place]);
  }
  const list = [...groups].map(([label, items]) => ({ label, places: items }));
  return [...list.filter((g) => g.label !== NO_AREA), ...list.filter((g) => g.label === NO_AREA)];
}

/**
 * Where autocomplete should look first, when we can't ask the device: the middle of this Together's places in the city
 * most of them are in. Null when no place has coordinates.
 */
export function usualArea(places: Place[]): Coordinates | null {
  const located = places.filter((p) => p.location);
  if (!located.length) return null;
  const cities = countBy(located, "city");
  const city = cities[0]?.value ?? "";
  const inCity = located.filter((p) => !city || p.city.trim() === city);
  const points = (inCity.length ? inCity : located).map((p) => p.location as Coordinates);
  return {
    lat: points.reduce((sum, p) => sum + p.lat, 0) / points.length,
    lng: points.reduce((sum, p) => sum + p.lng, 0) / points.length,
  };
}
