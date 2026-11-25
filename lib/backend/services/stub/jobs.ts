import "server-only";
import { addDays, TIME_ZONE, todayKey } from "@/lib/format";
import type { JobsBackendService } from "@/lib/backend/interfaces/jobs";
import type { ChoreReminder, FeedEvent } from "@/lib/models";
import { world } from "@/lib/backend/services/stub/state";

export class StubJobsService implements JobsBackendService {
  choreReminders() {
    const w = world();
    const today = todayKey();
    // chores in every Together the person is still in
    const data: ChoreReminder[] = w.pushSubscriptions
      .map(({ memberId, ...subscription }) => ({
        subscription,
        titles: Object.values(w.togethers)
          .filter((t) => t.together?.members.some((m) => m.id === memberId))
          .flatMap((t) => t.chores)
          .filter((c) => !c.done && c.due !== null && c.due <= today && c.assignees.includes(memberId))
          .map((c) => c.title)
          .sort(),
      }))
      .filter((r) => r.titles.length > 0);
    console.log(`[stub] choreReminders: ${data.length} device(s)`);
    return Promise.resolve({ data });
  }

  forgetPushSubscription({ endpoint }: { endpoint: string }) {
    console.log("[stub] forgetPushSubscription");
    const w = world();
    w.pushSubscriptions = w.pushSubscriptions.filter((p) => p.endpoint !== endpoint);
    return Promise.resolve();
  }

  cleanUpFiles() {
    // the stub's uploads abort themselves and its bucket lives only as long as the dev server, so there's nothing to sweep
    console.log("[stub] cleanUpFiles");
    return Promise.resolve({ data: { staleUploads: 0, objects: 0 } });
  }

  calendarFeed({ token }: { token: string }) {
    console.log("[stub] calendarFeed");
    const w = world();
    const link = w.calendarFeeds[token];
    const s = link ? w.togethers[link.togetherId] : undefined;
    const together = s?.together;
    if (!s || !together || !together.members.some((m) => m.id === link?.memberId)) return Promise.resolve({ data: null });
    const people = [...together.members, ...together.formerMembers];
    const from = addDays(todayKey(), -90);
    const events: FeedEvent[] = s.events
      .filter((e) => e.day >= from)
      .sort((a, b) => a.day.localeCompare(b.day) || (a.time ?? "").localeCompare(b.time ?? ""))
      .map((e) => ({
        id: e.id,
        title: e.title,
        day: e.day,
        time: e.time,
        location: e.location,
        placeName: e.place?.name ?? s.places.find((p) => p.id === e.place?.id)?.name ?? null,
        attendees: e.attendees.map((id) => people.find((m) => m.id === id)?.name).filter((n): n is string => !!n),
        createdAt: new Date().toISOString(),
      }));
    return Promise.resolve({ data: { togetherName: together.name, timeZone: TIME_ZONE, events } });
  }
}
