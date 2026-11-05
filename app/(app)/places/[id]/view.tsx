"use client";

import { AddEventSheet } from "@/components/calendar/add-event-sheet";
import { LogVisitSheet } from "@/components/places/log-visit-sheet";
import { PlaceNoteSheet } from "@/components/places/place-note-sheet";
import { PlaceDetailScreen } from "@/components/places/place-detail-screen";
import { usePlaceDetailViewModel, type PlaceDetailViewData } from "./view-model";

export function PlaceDetailView({ data }: { data: PlaceDetailViewData }) {
  const vm = usePlaceDetailViewModel(data);
  return (
    <>
      <PlaceDetailScreen {...vm.screen} />
      <LogVisitSheet {...vm.sheet} />
      <PlaceNoteSheet {...vm.noteSheet} />
      <AddEventSheet {...vm.planSheet} />
    </>
  );
}
