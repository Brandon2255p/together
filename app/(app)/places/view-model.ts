"use client";

import { useState } from "react";
import type { Route } from "next";
import type { PlaceCardData } from "@/components/places/places-screen";
import { addPlace } from "@/lib/actions/places";
import type { Place, PlaceStatus } from "@/lib/models";

export interface PlacesViewData {
  tab: PlaceStatus;
  places: Place[];
}

/** the average of everyone's ratings, or null when nobody has rated it */
export function averageRating(place: Place): number | null {
  const values = Object.values(place.ratings).filter((v): v is number => typeof v === "number");
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function toCard(p: Place): PlaceCardData {
  return {
    id: p.id,
    name: p.name,
    subtitle: `${p.category} · ${p.area}`,
    hue: p.hue,
    rating: averageRating(p),
    badge: p.status === "been" ? `Visited ${p.visits.length}×` : null,
    href: `/places/${p.id}` as Route,
  };
}

export function usePlacesViewModel(data: PlacesViewData) {
  const [tab, setTab] = useState<PlaceStatus>(data.tab);
  const [places, setPlaces] = useState(data.places);
  const [input, setInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onAdd() {
    if (!input.trim()) return;
    setAdding(true);
    setError(null);
    const result = await addPlace(input, tab);
    setAdding(false);
    if (!result.data) return setError(result.error ?? "Couldn't save that place.");
    const added = result.data;
    setPlaces((ps) => [added, ...ps]);
    setInput("");
  }

  return {
    tab,
    onTabChange: setTab,
    counts: {
      been: places.filter((p) => p.status === "been").length,
      want: places.filter((p) => p.status === "want").length,
    },
    input,
    onInputChange: (v: string) => {
      setInput(v);
      setError(null);
    },
    onAdd: () => void onAdd(),
    adding,
    places: places.filter((p) => p.status === tab).map(toCard),
    error,
  };
}
