"use client";

import { useState } from "react";
import type { Route } from "next";
import type { PlaceAddressCard, PlacePhoto } from "@/components/places/place-detail-screen";
import type { VisitDraft } from "@/components/places/log-visit-sheet";
import { logVisit } from "@/lib/actions/places";
import { addDays, dayAndMonth, dueLabel, todayKey } from "@/lib/format";
import type { GooglePlaceDetails, Place, Together } from "@/lib/models";
import { hoursLabel } from "@/lib/places/preview";
import { TEMP } from "../../_lib/optimistic";
import { useServerState } from "../../_lib/server-state";

export interface PlaceDetailViewData {
  place: Place;
  /** fetched fresh for this view (Google's terms), null for places added by hand or when Google didn't answer */
  google: GooglePlaceDetails | null;
  together: Together;
}

const join = (parts: string[], separator: string) => parts.map((p) => p.trim()).filter(Boolean).join(separator);

/** the address card: street and suburb, then our city · province · country labels, today's hours, and where it opens */
function addressCard(place: Place, google: GooglePlaceDetails | null): PlaceAddressCard {
  const street = google?.address.street || place.street;
  const line1 = join([street, place.area], ", ") || place.name;
  const line2 = join([place.city, place.province, place.country], " · ") || null;
  const query = join([place.name, street, place.area, place.city, place.country], ", ");
  const href = google?.googleMapsUri ?? place.mapsUrl ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  return { line1, line2, hours: hoursLabel(google), href, fromGoogle: google !== null };
}

/** "Adele rates it on their own." for each other member, then whether the place moves to Been */
function footnote(place: Place, together: Together): string {
  const others = together.members.filter((m) => m.id !== together.meId).map((m) => m.name);
  const own = others.length === 1 ? `${others[0]} rates it on their own.` : others.length ? "Everyone rates it on their own." : "";
  return join([own, place.status === "want" ? "The place moves to Been." : ""], " ");
}

export function usePlaceDetailViewModel({ place: initial, google, together }: PlaceDetailViewData) {
  // live sync: takes the newest place when the page reloads it (the other person logged a visit, say)
  const [place, setPlace] = useServerState(initial);
  const today = todayKey();
  const yesterday = addDays(today, -1);
  const blank: VisitDraft = { day: today, title: "", note: "", rating: place.ratings[together.meId] ?? null };
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState<VisitDraft>(blank);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Optimistic: the visit shows (and the place moves to Been) as the sheet closes. If the server says no, it's taken
   * back out and the sheet opens again with the error.
   */
  async function save() {
    if (!draft.title.trim()) return setError("Say what you did there.");
    const before = place;
    const rating = draft.rating;
    const visit = { day: draft.day, title: draft.title.trim(), note: draft.note.trim() || null, rating };
    setError(null);
    setPending(true);
    setSheetOpen(false);
    setPlace((p) => ({
      ...p,
      status: "been",
      visits: [{ id: `${TEMP}${Date.now()}`, ...visit }, ...p.visits],
      ratings: rating !== null ? { ...p.ratings, [together.meId]: rating } : p.ratings,
    }));
    const result = await logVisit({ placeId: place.id, ...visit });
    setPending(false);
    if (!result.data) {
      setPlace(before);
      setError(result.error ?? "We couldn't save that visit. Try again.");
      setSheetOpen(true);
      return;
    }
    setPlace(result.data);
    setDraft({ ...blank, rating: result.data.ratings[together.meId] ?? null });
  }

  const visits = [...place.visits]
    .sort((a, b) => b.day.localeCompare(a.day))
    .map((v) => {
      const [day, month] = dayAndMonth(v.day);
      return { id: v.id, day, month, title: v.title, note: v.note, rating: v.rating };
    });
  const photo: PlacePhoto | null = google?.photo ?? null;

  return {
    screen: {
      name: place.name,
      hue: place.hue,
      photo,
      googleRating: google?.rating ?? null,
      tags: [
        { label: place.category, tone: "neutral" as const },
        { label: place.area, tone: "neutral" as const },
        place.status === "been"
          ? { label: place.visits.length ? `Been ${place.visits.length}×` : "Been", tone: "success" as const }
          : { label: "Want to go", tone: "partner" as const },
      ].filter((t) => t.label),
      ratings: together.members.map((member) => ({ member, value: place.ratings[member.id] ?? null })),
      address: addressCard(place, google),
      visits,
      backHref: (place.status === "want" ? "/places?tab=want" : "/places") as Route,
      editHref: `/places/${place.id}/edit` as Route,
      onLogVisit: () => {
        setError(null);
        setSheetOpen(true);
      },
    },
    sheet: {
      open: sheetOpen,
      onOpenChange: setSheetOpen,
      subtitle: join([place.name, join([place.area, place.city], ", ")], " · "),
      draft,
      onDraftChange: (patch: Partial<VisitDraft>) => {
        setError(null);
        setDraft((d) => ({ ...d, ...patch }));
      },
      today,
      yesterday,
      pickedLabel: dueLabel(draft.day, today),
      footnote: footnote(place, together),
      onSubmit: () => void save(),
      pending,
      error,
    },
  };
}
