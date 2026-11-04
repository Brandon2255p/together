"use client";

import type { Route } from "next";
import type { PlaceAddressCard, PlacePhoto } from "@/components/places/place-detail-screen";
import { dayAndMonth } from "@/lib/format";
import type { GooglePlaceDetails, Place, Together } from "@/lib/models";

export interface PlaceDetailViewData {
  place: Place;
  /** fetched fresh for this view (Google's terms), null for places added by hand or when Google didn't answer */
  google: GooglePlaceDetails | null;
  together: Together;
}

const join = (parts: string[], separator: string) => parts.map((p) => p.trim()).filter(Boolean).join(separator);

/** the address card: street and suburb, then our city · province · country labels, today's hours, and where it opens */
function addressCard(place: Place, google: GooglePlaceDetails | null): PlaceAddressCard {
  const street = google?.address.street || place.street;
  const line1 = join([street, place.area], ", ") || place.name;
  const line2 = join([place.city, place.province, place.country], " · ") || null;
  const hours =
    google?.openNow === true
      ? { text: google.closesAt ? `Open until ${google.closesAt}` : "Open now", open: true }
      : google?.openNow === false
        ? { text: "Closed now", open: false }
        : null;
  const query = join([place.name, street, place.area, place.city, place.country], ", ");
  const href = google?.googleMapsUri ?? place.mapsUrl ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  return { line1, line2, hours, href, fromGoogle: google !== null };
}

export function usePlaceDetailViewModel({ place, google, together }: PlaceDetailViewData) {
  const visits = [...place.visits]
    .sort((a, b) => b.day.localeCompare(a.day))
    .map((v) => {
      const [day, month] = dayAndMonth(v.day);
      return { id: v.id, day, month, title: v.title, note: v.note, rating: v.rating };
    });
  const photo: PlacePhoto | null = google?.photo ?? null;

  return {
    name: place.name,
    hue: place.hue,
    photo,
    googleRating: google?.rating ?? null,
    tags: [
      { label: place.category, tone: "neutral" as const },
      { label: place.area, tone: "neutral" as const },
      place.status === "been"
        ? { label: `Been ${place.visits.length}×`, tone: "success" as const }
        : { label: "Want to go", tone: "partner" as const },
    ].filter((t) => t.label),
    ratings: together.members.map((member) => ({ member, value: place.ratings[member.id] ?? null })),
    address: addressCard(place, google),
    visits,
    backHref: (place.status === "want" ? "/places?tab=want" : "/places") as Route,
    // TODO: logging visits needs its own sheet + backend call (screen 24)
    onLogVisit: () => undefined,
  };
}
