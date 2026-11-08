"use client";

import { useEffect, useState } from "react";
import type { Route } from "next";
import type { EventDraft } from "@/components/calendar/add-event-sheet";
import type { AgendaRow } from "@/components/calendar/calendar-screen";
import { addEvent, deleteEvent, getEvents, updateEvent } from "@/lib/actions/calendar";
import { agendaFor, gridRange, monthGrid } from "@/lib/calendar/month";
import { dayDate, monthName, shortDay, toKey } from "@/lib/format";
import { TEMP, type Optimistic } from "../_lib/optimistic";
import type { CalendarEvent, Chore, DayKey, Member, NewEvent, Together } from "@/lib/models";
import { toChoreRow } from "../_lib/chore-rows";
import { useChoreSheet } from "../_lib/use-chore-sheet";
import { useChores } from "../_lib/use-chores";

export interface CalendarViewData {
  together: Together;
  today: DayKey;
  /** the day it opens on (today, or ?day=), and whose month's grid `events` covers */
  selected: DayKey;
  events: CalendarEvent[];
  chores: Chore[];
}

const emptyDraft = (day: DayKey, meId: string): EventDraft => ({ title: "", day, time: "", location: "", attendees: [meId] });

const longDay = (key: DayKey) =>
  dayDate(key).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export function useCalendarViewModel(data: CalendarViewData) {
  const { together, today } = data;
  const t = dayDate(today);
  // the month the page loaded
  const start = dayDate(data.selected);
  const [month, setMonth] = useState({ year: start.getUTCFullYear(), month: start.getUTCMonth() });
  const [selected, setSelected] = useState<DayKey>(data.selected);
  const [events, setEvents] = useState<Optimistic<CalendarEvent>[]>(data.events);
  // the page loads the starting month; another month shown here is fetched again when the page reloads (live changes)
  const [loaded, setLoaded] = useState(data.events);
  const [stale, setStale] = useState(false);
  if (loaded !== data.events) {
    setLoaded(data.events);
    if (month.year === start.getUTCFullYear() && month.month === start.getUTCMonth()) setEvents(data.events);
    else setStale(true);
  }
  useEffect(() => {
    if (!stale) return;
    const { from, to } = gridRange(month.year, month.month);
    let current = true;
    void getEvents(from, to).then((result) => {
      if (!current) return;
      setStale(false);
      if (result.data) setEvents(result.data);
    });
    return () => {
      current = false;
    };
  }, [stale, month]);
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState<EventDraft>(() => emptyDraft(today, together.meId));
  const [addError, setAddError] = useState<string | null>(null);
  // the plan open in the add sheet to change it; null when adding a new one
  const [editingId, setEditingId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const choreStore = useChores(data.chores);
  const { chores, error: choreError, toggle } = choreStore;
  const choreSheet = useChoreSheet(together, today, choreStore);

  const toneOf = (id: string) => together.members.find((m) => m.id === id)?.tone;
  const people = (ids: string[]) => ids.map((id) => together.members.find((m) => m.id === id)).filter((m): m is Member => !!m);

  async function goTo(delta: number) {
    const d = new Date(Date.UTC(month.year, month.month + delta, 1));
    const next = { year: d.getUTCFullYear(), month: d.getUTCMonth() };
    setMonth(next);
    setSelected(next.year === t.getUTCFullYear() && next.month === t.getUTCMonth() ? today : toKey(d));
    setLoading(true);
    setLoadError(null);
    const { from, to } = gridRange(next.year, next.month);
    const result = await getEvents(from, to);
    setLoading(false);
    if (!result.data) return setLoadError(result.error ?? "Couldn't load that month.");
    setEvents(result.data);
  }

  /** optimistic too: the change shows at once; if saving fails it goes back, and the sheet opens again with the draft */
  async function onUpdate(id: string, event: NewEvent) {
    const before = events;
    const submitted = draft;
    setEvents((es) => es.map((e) => (e.id === id ? { ...e, ...event } : e)));
    setSelected(event.day);
    setAddOpen(false);
    setAddError(null);
    const result = await updateEvent(id, event);
    if (!result.data) {
      setEvents(before);
      setDraft(submitted);
      setAddError(result.error ?? "Couldn't save that plan.");
      setAddOpen(true);
      return;
    }
    const saved = result.data;
    setEditingId(null);
    setDraft(emptyDraft(event.day, together.meId));
    setEvents((es) => es.map((e) => (e.id === id ? { ...saved, clientKey: e.clientKey } : e)));
  }

  /** optimistic: the plan shows straight away, and goes again if saving fails */
  async function onAdd() {
    const title = draft.title.trim();
    if (!title) return setAddError("Give it a name.");
    const event = {
      title,
      day: draft.day,
      time: draft.time || null,
      location: draft.location.trim() || null,
      attendees: draft.attendees,
    };
    if (editingId) return onUpdate(editingId, event);
    const tempId = `${TEMP}${Date.now()}`;
    setEvents((es) => [...es, { ...event, id: tempId, place: null }]);
    setSelected(draft.day);
    setAddOpen(false);
    setAddError(null);
    setDraft(emptyDraft(draft.day, together.meId));
    const result = await addEvent(event);
    if (!result.data) {
      setEvents((es) => es.filter((e) => e.id !== tempId));
      setLoadError(result.error ?? "Couldn't add that to the calendar.");
      return;
    }
    const saved = result.data;
    setEvents((es) => es.map((e) => (e.id === tempId ? { ...saved, clientKey: tempId } : e)));
  }

  function onEdit(id: string) {
    const e = events.find((x) => x.id === id);
    if (!e || id.startsWith(TEMP)) return;
    setOpenId(null);
    setEditingId(id);
    setDraft({ title: e.title, day: e.day, time: e.time ?? "", location: e.location ?? "", attendees: e.attendees });
    setAddError(null);
    setAddOpen(true);
  }

  async function onDelete(id: string) {
    if (id.startsWith(TEMP)) return;
    const before = events;
    setDeleting(true);
    setDeleteError(null);
    const result = await deleteEvent(id);
    setDeleting(false);
    if (!result.success) return setDeleteError(result.error ?? "Couldn't remove that.");
    setOpenId(null);
    setEvents(before.filter((e) => e.id !== id));
  }

  const open = events.find((e) => e.id === openId) ?? null;

  const agenda: AgendaRow[] = agendaFor(selected, events, chores).map((entry) => {
    if (entry.kind === "chore") return { kind: "chore", id: entry.key, row: toChoreRow(entry.chore, together.members, today) };
    const e = entry.event;
    const tone = e.attendees.length > 1 ? "ink" : (toneOf(e.attendees[0] ?? "") ?? "ink");
    return { kind: "event", id: e.id, key: (e as Optimistic<CalendarEvent>).clientKey, title: e.title, when: e.time ?? "All day", where: e.location, people: people(e.attendees), tone };
  });

  return {
    monthLabel: monthName(month.year, month.month),
    yearLabel: String(month.year),
    weeks: monthGrid(month.year, month.month, events, chores, toneOf),
    today,
    selected,
    onSelect: setSelected,
    onPrevMonth: () => void goTo(-1),
    onNextMonth: () => void goTo(1),
    legend: together.members,
    agendaTitle: selected === today ? `Today · ${shortDay(selected)}` : shortDay(selected),
    agenda,
    onChoreDoneChange: (id: string, done: boolean) => void toggle(id, done),
    onChoreOpen: choreSheet.openEdit,
    choreSheet: choreSheet.sheet,
    loading,
    error: loadError ?? choreError,
    onAddPress: () => {
      // coming from an edit: start a fresh draft
      setDraft((d) => (editingId ? emptyDraft(selected, together.meId) : { ...d, day: selected }));
      setEditingId(null);
      setAddError(null);
      setAddOpen(true);
    },
    addSheet: {
      open: addOpen,
      onOpenChange: setAddOpen,
      draft,
      onDraftChange: (patch: Partial<EventDraft>) => setDraft((d) => ({ ...d, ...patch })),
      dayLabel: longDay(draft.day),
      members: together.members,
      onSubmit: () => void onAdd(),
      pending: false,
      error: addError,
      mode: editingId ? ("edit" as const) : ("add" as const),
    },
    onEventOpen: (id: string) => {
      setDeleteError(null);
      setOpenId(id);
    },
    eventSheet: {
      event: open
        ? {
            id: open.id,
            title: open.title,
            when: `${longDay(open.day)} · ${open.time ?? "All day"}`,
            where: open.location,
            people: people(open.attendees),
            place: open.place ? { name: open.place.name, href: `/places/${open.place.id}` as Route } : null,
          }
        : null,
      onClose: () => setOpenId(null),
      onEdit,
      onDelete: (id: string) => void onDelete(id),
      pending: deleting,
      error: deleteError,
    },
  };
}
