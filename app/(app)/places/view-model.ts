"use client";

import { useState } from "react";
import type { Route } from "next";
import type { PlaceCardData } from "@/components/places/places-screen";
import type { AreaLevel } from "@/components/places/place-filter-sheet";
import type { Coordinates, Place, PlaceFilter, PlaceSort, PlaceStatus } from "@/lib/models";
import {
  applyFilter,
  averageRating,
  filterLabel,
  filterOptions,
  groupByArea,
  isFiltered,
  narrowFilter,
  NO_FILTER,
  SORT_LABELS,
  sortPlaces,
  withParents,
} from "@/lib/places/address";

export interface PlacesViewData {
  tab: PlaceStatus;
  places: Place[];
}

/** "Japanese · 21 Beach Rd, Sea Point": a Google place's street isn't stored, so it shows the suburb */
function subtitle(p: Place): string {
  const where = [p.street, p.area].map((s) => s.trim()).filter(Boolean).join(", ");
  return [p.category, where].filter(Boolean).join(" · ");
}

function toCard(p: Place): PlaceCardData {
  return {
    id: p.id,
    name: p.name,
    subtitle: subtitle(p),
    hue: p.hue,
    rating: averageRating(p),
    badge: p.status === "been" && p.visits.length ? `Visited ${p.visits.length}×` : null,
    href: `/places/${p.id}` as Route,
  };
}

const SORTS: PlaceSort[] = ["top", "recent", "nearest", "az"];

/** the device's location, asked for only when someone sorts by Nearest */
function locate(): Promise<Coordinates | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) =>
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => resolve(null),
      { maximumAge: 10 * 60 * 1000, timeout: 10_000 },
    ),
  );
}

export function usePlacesViewModel(data: PlacesViewData) {
  const { places } = data;
  const [tab, setTab] = useState<PlaceStatus>(data.tab);
  const [filter, setFilter] = useState<PlaceFilter>(NO_FILTER);
  const [draft, setDraft] = useState<PlaceFilter>(NO_FILTER);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [here, setHere] = useState<Coordinates | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onTab = places.filter((p) => p.status === tab);
  const groups = groupByArea(sortPlaces(applyFilter(onTab, filter), filter.sort, here)).map((g) => ({
    label: g.label,
    places: g.places.map(toCard),
  }));

  // the sheet counts both tabs: it's about where your places are, not which list they're on
  const options = filterOptions(places, draft);

  function openSheet() {
    setDraft(filter);
    setSheetOpen(true);
  }

  async function apply() {
    setSheetOpen(false);
    setError(null);
    setFilter(draft);
    if (draft.sort === "nearest" && !here) {
      const position = await locate();
      if (position) setHere(position);
      else setError("We couldn't get your location, so places are A to Z. Allow location to sort by distance.");
    }
  }

  return {
    screen: {
      tab,
      onTabChange: setTab,
      counts: {
        been: places.filter((p) => p.status === "been").length,
        want: places.filter((p) => p.status === "want").length,
      },
      addHref: `/places/new?tab=${tab}` as Route,
      filterChip: filterLabel(filter),
      onClearFilter: () => setFilter((f) => ({ ...NO_FILTER, sort: f.sort })),
      sortLabel: SORT_LABELS[filter.sort],
      onOpenFilters: openSheet,
      groups,
      filteredOut: groups.length === 0 && onTab.length > 0 && isFiltered(filter),
      error,
    },
    sheet: {
      open: sheetOpen,
      onOpenChange: setSheetOpen,
      options: { country: options.countries, province: options.provinces, city: options.cities },
      selected: { country: draft.country, province: draft.province, city: draft.city },
      onSelect: (level: AreaLevel, value: string) =>
        setDraft((d) => narrowFilter(places, withParents(places, { ...d, [level]: d[level] === value ? "" : value }))),
      sort: draft.sort,
      sorts: SORTS.map((value) => ({
        value,
        label: SORT_LABELS[value],
        hint: value === "nearest" ? "Uses your location, only on this phone" : undefined,
      })),
      onSortChange: (sort: PlaceSort) => setDraft((d) => ({ ...d, sort })),
      onClear: () => setDraft(NO_FILTER),
      onApply: () => void apply(),
      matching: applyFilter(places, draft).length,
    },
  };
}
