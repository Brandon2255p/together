"use client";

import { PlaceFormScreen } from "@/components/places/place-form-screen";
import { useManualPlaceViewModel, type ManualPlaceViewData } from "./view-model";

export function ManualPlaceView({ data }: { data: ManualPlaceViewData }) {
  const vm = useManualPlaceViewModel(data);
  return <PlaceFormScreen {...vm} />;
}
