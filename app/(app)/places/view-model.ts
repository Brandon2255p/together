"use client";

import { useState } from "react";
import type { Route } from "next";
import type { PlaceCardData } from "@/components/places/places-screen";
import { addPlace } from "@/lib/actions/places";
import type { Hue, Place, PlaceStatus } from "@/lib/models";
import { TEMP, type Optimistic } from "../_lib/optimistic";
import { isShortMapsLink, placeFromMapsUrl, readPlaceInput } from "@/lib/places/maps-link";

export interface PlacesViewData {
  tab: PlaceStatus;
  places: Place[];
}

/** the average of everyone's ratings, or null when nobody has rated it */
export function averageRating(place: Place): number | null {
  const values = Object.values(place.ratings).filter((v): v is number => typeof v === "number");
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

/** what we can show before the server answers: the name we can read locally, or a placeholder while a short link is followed */
function optimisticName(input: string): string {
  const parsed = readPlaceInput(input);
  if (!parsed) return input.trim();
  if (parsed.kind === "name") return parsed.name;
  if (parsed.label) return parsed.label;
  return isShortMapsLink(parsed.url) ? "Looking it up…" : placeFromMapsUrl(parsed.url, parsed.url, null).name;
}

function toCard(p: Optimistic<Place>): PlaceCardData {
  return {
    id: p.id,
    key: p.clientKey ?? p.id,
    name: p.name,
    subtitle: `${p.category} · ${p.area}`,
    hue: p.hue,
    rating: averageRating(p),
    badge: p.status === "been" ? `Visited ${p.visits.length}×` : null,
    href: `/places/${p.id}` as Route,
    pending: p.id.startsWith(TEMP),
  };
}

const HUES: Hue[] = ["accent", "partner", "success", "warning"];

export function usePlacesViewModel(data: PlacesViewData) {
  const [tab, setTab] = useState<PlaceStatus>(data.tab);
  const [places, setPlaces] = useState<Optimistic<Place>[]>(data.places);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  /** optimistic: a placeholder card appears straight away while the server reads the Maps link and saves it */
  async function onAdd() {
    const text = input.trim();
    if (!text) return;
    if (!readPlaceInput(text)) return setError("Paste a Google Maps link or type the place's name.");
    const tempId = `${TEMP}${Date.now()}`;
    const placeholder: Place = {
      id: tempId,
      name: optimisticName(text),
      category: "Saving",
      area: "Reading the link…",
      mapsUrl: null,
      status: tab,
      ratings: {},
      visits: [],
      hue: HUES[places.length % HUES.length] ?? "accent",
      street: "",
      city: "",
      province: "",
      country: "",
      googlePlaceId: null,
      location: null,
    };
    setError(null);
    setInput("");
    setPlaces((ps) => [placeholder, ...ps]);
    const result = await addPlace(text, tab);
    if (!result.data) {
      setPlaces((ps) => ps.filter((p) => p.id !== tempId));
      setInput(text);
      return setError(result.error ?? "Couldn't save that place.");
    }
    const added = result.data;
    // a Google place that's already saved comes back as the existing one: drop the placeholder instead of doubling it
    setPlaces((ps) =>
      ps.some((p) => p.id === added.id)
        ? ps.filter((p) => p.id !== tempId)
        : ps.map((p) => (p.id === tempId ? { ...added, clientKey: tempId } : p)),
    );
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
    adding: false,
    places: places.filter((p) => p.status === tab).map(toCard),
    error,
  };
}
