"use client";

import { AddPlacePreview, AddPlaceSearch } from "@/components/places/add-place-screen";
import { useAddPlaceViewModel, type AddPlaceViewData } from "./view-model";

export function AddPlaceView({ data }: { data: AddPlaceViewData }) {
  const vm = useAddPlaceViewModel(data);
  return vm.showPreview ? <AddPlacePreview {...vm.preview} /> : <AddPlaceSearch {...vm.search} />;
}
