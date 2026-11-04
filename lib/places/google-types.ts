import type { PlaceAddress } from "@/lib/models";

/** the kinds a place can be; a place's kind is ours to change, Google's type only suggests one */
export const PLACE_KINDS = ["Restaurant", "Café", "Bar", "Bakery", "Hike", "Other"] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number];

/**
 * Google's primary type → our kind. Google's cuisines ("japanese_restaurant", "pizza_restaurant") are restaurants.
 * https://developers.google.com/maps/documentation/places/web-service/place-types
 */
export function kindFromGoogleType(primaryType: string | null | undefined): PlaceKind {
  const type = primaryType ?? "";
  if (type === "bakery") return "Bakery";
  if (type === "cafe" || type === "coffee_shop" || type === "tea_house" || type === "cafeteria") return "Café";
  if (type === "bar" || type === "pub" || type === "wine_bar" || type === "cocktail_bar" || type === "bar_and_grill") {
    return "Bar";
  }
  if (type === "restaurant" || type.endsWith("_restaurant") || type === "diner" || type === "steak_house") {
    return "Restaurant";
  }
  if (type === "hiking_area" || type === "park" || type === "national_park" || type === "state_park") return "Hike";
  return "Other";
}

/** an entry of a Places API (New) place's `addressComponents` */
export interface AddressComponent {
  longText?: string;
  shortText?: string;
  types?: string[];
}

const LIMITS: Record<keyof PlaceAddress, number> = { street: 80, area: 60, city: 80, province: 80, country: 80 };

/**
 * Google's address parts → ours: country; administrative_area_level_1 is the province or state; locality is the city
 * (postal_town where there's no locality, as in the UK); sublocality or neighborhood is the area; street_number and
 * route make the street.
 */
export function addressFromComponents(components: AddressComponent[] | undefined): PlaceAddress {
  const find = (...types: string[]) =>
    types.map((type) => components?.find((c) => c.types?.includes(type))?.longText?.trim()).find(Boolean) ?? "";
  const route = find("route");
  const number = find("street_number");
  const address: PlaceAddress = {
    street: route ? (number ? `${number} ${route}` : route) : "",
    area: find("sublocality_level_1", "sublocality", "neighborhood"),
    city: find("locality", "postal_town"),
    province: find("administrative_area_level_1"),
    country: find("country"),
  };
  for (const key of Object.keys(LIMITS) as (keyof PlaceAddress)[]) address[key] = address[key].slice(0, LIMITS[key]);
  return address;
}

/**
 * When a place that's open now closes, in its own time ("22:00"): Google gives `nextCloseTime` in UTC and the place's
 * offset from UTC in minutes. Null when it doesn't close within the next 24 hours (open around the clock).
 */
export function closingTime(nextCloseTime: string | undefined, utcOffsetMinutes: number | undefined, now = new Date()) {
  if (!nextCloseTime || utcOffsetMinutes === undefined) return null;
  const closes = new Date(nextCloseTime);
  const ms = closes.getTime() - now.getTime();
  if (Number.isNaN(ms) || ms < 0 || ms > 24 * 60 * 60 * 1000) return null;
  const local = new Date(closes.getTime() + utcOffsetMinutes * 60 * 1000);
  return `${String(local.getUTCHours()).padStart(2, "0")}:${String(local.getUTCMinutes()).padStart(2, "0")}`;
}
