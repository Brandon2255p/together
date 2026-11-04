"use client";

import { LogVisitSheet } from "@/components/places/log-visit-sheet";
import { PlaceDetailScreen } from "@/components/places/place-detail-screen";
import { usePlaceDetailViewModel, type PlaceDetailViewData } from "./view-model";

export function PlaceDetailView({ data }: { data: PlaceDetailViewData }) {
  const vm = usePlaceDetailViewModel(data);
  return (
    <>
      <PlaceDetailScreen {...vm.screen} />
      <LogVisitSheet {...vm.sheet} />
    </>
  );
}
