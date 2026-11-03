"use client";

import { PlaceDetailScreen } from "@/components/places/place-detail-screen";
import { usePlaceDetailViewModel, type PlaceDetailViewData } from "./view-model";

export function PlaceDetailView({ data }: { data: PlaceDetailViewData }) {
  const vm = usePlaceDetailViewModel(data);
  return <PlaceDetailScreen {...vm} />;
}
