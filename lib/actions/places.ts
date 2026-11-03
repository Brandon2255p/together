"use server";

import { serverBackend } from "@/lib/backend/server";
import type { PlaceStatus } from "@/lib/models";
import { placeFromInput } from "@/lib/places/maps-link";

export async function getPlaces() {
  return serverBackend.getPlaces();
}

export async function getPlace(id: string) {
  return serverBackend.getPlace({ id });
}

/** `input`: a Google Maps link or just a name */
export async function addPlace(input: string, status: PlaceStatus) {
  const parsed = placeFromInput(input);
  if (!parsed) return { data: null, error: "Paste a Google Maps link or type the place's name." };
  return serverBackend.addPlace({ ...parsed, status });
}
