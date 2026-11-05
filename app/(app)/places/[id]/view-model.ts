"use client";

import { useState } from "react";
import type { Route } from "next";
import type { EventDraft } from "@/components/calendar/add-event-sheet";
import type { PlaceAddressCard, PlacePhoto, PlacePlanRow } from "@/components/places/place-detail-screen";
import type { VisitDraft } from "@/components/places/log-visit-sheet";
import { addEvent } from "@/lib/actions/calendar";
import { logVisit, setPlaceNote } from "@/lib/actions/places";
import { addDays, dayAndMonth, dayDate, dueLabel, todayKey } from "@/lib/format";
import type { CalendarEvent, GooglePlaceDetails, Member, Place, Together } from "@/lib/models";
import { hoursLabel } from "@/lib/places/preview";
import { TEMP } from "../../_lib/optimistic";
import { useServerState } from "../../_lib/server-state";

export interface PlaceDetailViewData {
  place: Place;
  /** fetched fresh for this view (Google's terms), null for places added by hand or when Google didn't answer */
  google: GooglePlaceDetails | null;
  together: Together;
  /** its plans on the calendar from today on */
  plans: CalendarEvent[];
}

const weekday = (key: string) => dayDate(key).toLocaleDateString("en-ZA", { weekday: "short", timeZone: "UTC" });
const longDay = (key: string) =>
  dayDate(key).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** where a plan says it is: the place's suburb and city, else its name */
const planLocation = (place: Place) => join([place.area, place.city], ", ").slice(0, 120) || place.name.slice(0, 120);

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

export function usePlaceDetailViewModel({ place: initial, google, together, plans: initialPlans }: PlaceDetailViewData) {
  // live sync: takes the newest place when the page reloads it (the other person logged a visit, say)
  const [place, setPlace] = useServerState(initial);
  const [plans, setPlans] = useServerState(initialPlans);
  const note = useNote(place, setPlace);
  const plan = usePlanSheet(place, together, setPlans);
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
      note: place.note || null,
      onEditNote: note.open,
      plans: plans.map((p) => planRow(p, together.members)),
      onPlanVisit: plan.open,
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
    noteSheet: note.sheet,
    planSheet: plan.sheet,
  };
}

function planRow(plan: CalendarEvent, members: Member[]): PlacePlanRow {
  const [day, month] = dayAndMonth(plan.day);
  return {
    id: plan.id,
    day,
    month,
    title: plan.title,
    when: `${weekday(plan.day)} · ${plan.time ?? "All day"}`,
    people: plan.attendees.map((id) => members.find((m) => m.id === id)).filter((m): m is Member => !!m),
    href: `/calendar?day=${plan.day}` as Route,
    pending: plan.id.startsWith(TEMP),
  };
}

type SetState<T> = (update: T | ((current: T) => T)) => void;

/** the note sheet: optimistic, so the note shows as the sheet closes, and comes back with the error if saving fails */
function useNote(place: Place, setPlace: SetState<Place>) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(text: string) {
    const before = place;
    setError(null);
    setPending(true);
    setOpen(false);
    setPlace((p) => ({ ...p, note: text.trim() }));
    const result = await setPlaceNote(place.id, text);
    setPending(false);
    if (!result.data) {
      setPlace(before);
      setDraft(text);
      setError(result.error ?? "We couldn't save that note. Try again.");
      setOpen(true);
      return;
    }
    setPlace(result.data);
  }

  return {
    open: () => {
      setDraft(place.note);
      setError(null);
      setOpen(true);
    },
    sheet: {
      open,
      onOpenChange: setOpen,
      placeName: place.name,
      draft,
      onDraftChange: (text: string) => {
        setError(null);
        setDraft(text);
      },
      hasNote: place.note !== "",
      onSubmit: () => void save(draft),
      onRemove: () => void save(""),
      pending,
      error,
    },
  };
}

/**
 * Plan to go: a plan on the shared calendar, linked to this place. Starts as the place's name, today, everyone going.
 * Optimistic: it shows in Plans as the sheet closes, and the sheet opens again with the error if saving fails.
 */
function usePlanSheet(place: Place, together: Together, setPlans: SetState<CalendarEvent[]>) {
  const blank = (): EventDraft => ({
    title: place.name.slice(0, 120),
    day: todayKey(),
    time: "",
    location: planLocation(place),
    attendees: together.members.map((m) => m.id),
  });
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<EventDraft>(blank);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const title = draft.title.trim();
    if (!title) return setError("Give it a name.");
    const event = { title, day: draft.day, time: draft.time || null, location: draft.location.trim() || null, attendees: draft.attendees };
    const tempId = `${TEMP}${Date.now()}`;
    const byDay = (a: CalendarEvent, b: CalendarEvent) => a.day.localeCompare(b.day) || (a.time ?? "").localeCompare(b.time ?? "");
    const submitted = draft;
    setError(null);
    setPending(true);
    setOpen(false);
    // a plan for a past day goes on the calendar but not in Plans (which starts today)
    if (event.day >= todayKey()) {
      setPlans((ps) => [...ps, { ...event, id: tempId, place: { id: place.id, name: place.name } }].sort(byDay));
    }
    const result = await addEvent({ ...event, placeId: place.id });
    setPending(false);
    if (!result.data) {
      setPlans((ps) => ps.filter((p) => p.id !== tempId));
      setDraft(submitted);
      setError(result.error ?? "We couldn't add that to the calendar. Try again.");
      setOpen(true);
      return;
    }
    const saved = result.data;
    setPlans((ps) => ps.map((p) => (p.id === tempId ? saved : p)));
    setDraft(blank());
  }

  return {
    open: () => {
      setError(null);
      setOpen(true);
    },
    sheet: {
      open,
      onOpenChange: setOpen,
      draft,
      onDraftChange: (patch: Partial<EventDraft>) => {
        setError(null);
        setDraft((d) => ({ ...d, ...patch }));
      },
      dayLabel: longDay(draft.day),
      members: together.members,
      onSubmit: () => void save(),
      pending,
      error,
      eyebrow: "Plan to go",
    },
  };
}
