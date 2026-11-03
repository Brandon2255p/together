"use client";

import type { Route } from "next";
import { dayAndMonth } from "@/lib/format";
import type { Place, Together } from "@/lib/models";

export interface PlaceDetailViewData {
  place: Place;
  together: Together;
}

export function usePlaceDetailViewModel({ place, together }: PlaceDetailViewData) {
  const visits = [...place.visits]
    .sort((a, b) => b.day.localeCompare(a.day))
    .map((v) => {
      const [day, month] = dayAndMonth(v.day);
      return { id: v.id, day, month, title: v.title, note: v.note, rating: v.rating };
    });

  return {
    name: place.name,
    hue: place.hue,
    tags: [
      { label: place.category, tone: "neutral" as const },
      { label: place.area, tone: "neutral" as const },
      place.status === "been"
        ? { label: `Been ${place.visits.length}×`, tone: "success" as const }
        : { label: "Want to go", tone: "partner" as const },
    ],
    ratings: together.members.map((member) => ({ member, value: place.ratings[member.id] ?? null })),
    mapsUrl: place.mapsUrl,
    visits,
    backHref: (place.status === "want" ? "/places?tab=want" : "/places") as Route,
    // TODO: logging visits needs its own sheet + backend call
    onLogVisit: () => undefined,
  };
}
