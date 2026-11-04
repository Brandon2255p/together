"use client";

import { PlaceFormScreen } from "@/components/places/place-form-screen";
import { useEditPlaceViewModel, type EditPlaceViewData } from "./view-model";

export function EditPlaceView({ data }: { data: EditPlaceViewData }) {
  const vm = useEditPlaceViewModel(data);
  return <PlaceFormScreen {...vm} />;
}
