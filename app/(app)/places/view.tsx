"use client";

import { PlacesScreen } from "@/components/places/places-screen";
import { usePlacesViewModel, type PlacesViewData } from "./view-model";

export function PlacesView({ data }: { data: PlacesViewData }) {
  const vm = usePlacesViewModel(data);
  return <PlacesScreen {...vm} />;
}
