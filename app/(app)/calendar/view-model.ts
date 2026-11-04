"use client";

import { useEffect, useState } from "react";
import type { EventDraft } from "@/components/calendar/add-event-sheet";
import type { AgendaRow } from "@/components/calendar/calendar-screen";
import { addEvent, deleteEvent, getEvents } from "@/lib/actions/calendar";
import { agendaFor, gridRange, monthGrid } from "@/lib/calendar/month";
import { dayDate, monthName, shortDay, toKey } from "@/lib/format";
import { TEMP, type Optimistic } from "../_lib/optimistic";
import type { CalendarEvent, Chore, DayKey, Member, Together } from "@/lib/models";
import { toChoreRow } from "../_lib/chore-rows";
import { useChores } from "../_lib/use-chores";

export interface CalendarViewData {
  together: Together;
  today: DayKey;
  /** the current month's grid */
  events: CalendarEvent[];
  chores: Chore[];
}

const emptyDraft = (day: DayKey, meId: string): EventDraft => ({ title: "", day, time: "", location: "", attendees: [meId] });

const longDay = (key: DayKey) =>
  dayDate(key).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export function useCalendarViewModel(data: CalendarViewData) {
  const { together, today } = data;
  const t = dayDate(today);
  const [month, setMonth] = useState({ year: t.getUTCFullYear(), month: t.getUTCMonth() });
  const [selected, setSelected] = useState<DayKey>(today);
  const [events, setEvents] = useState<Optimistic<CalendarEvent>[]>(data.events);
  // the page loads this month; another month shown here is fetched again when the page reloads (live changes)
  const [loaded, setLoaded] = useState(data.events);
  const [stale, setStale] = useState(false);
  if (loaded !== data.events) {
    setLoaded(data.events);
    if (month.year === t.getUTCFullYear() && month.month === t.getUTCMonth()) setEvents(data.events);
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
  const [openId, setOpenId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { chores, error: choreError, toggle } = useChores(data.chores);

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
    const tempId = `${TEMP}${Date.now()}`;
    setEvents((es) => [...es, { ...event, id: tempId }]);
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
    loading,
    error: loadError ?? choreError,
    onAddPress: () => {
      setDraft((d) => ({ ...d, day: selected }));
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
          }
        : null,
      onClose: () => setOpenId(null),
      onDelete: (id: string) => void onDelete(id),
      pending: deleting,
      error: deleteError,
    },
  };
}
