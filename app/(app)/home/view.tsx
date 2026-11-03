"use client";

import { HomeScreen } from "@/components/home/home-screen";
import { useHomeViewModel, type HomeViewData } from "./view-model";

export function HomeView({ data }: { data: HomeViewData }) {
  const vm = useHomeViewModel(data);
  return <HomeScreen {...vm} />;
}
