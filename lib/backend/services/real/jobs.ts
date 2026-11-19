import "server-only";
import type { JobsBackendService } from "@/lib/backend/interfaces/jobs";
import type { CalendarFeed, ChoreReminder, FeedEvent } from "@/lib/models";
import { createAdminClient } from "@/lib/supabase/admin";

interface ReminderRow {
  endpoint: string;
  p256dh: string;
  auth: string;
  titles: string[];
}

/** what v1_calendar_feed returns */
interface FeedRow {
  name: string;
  time_zone: string;
  events: {
    id: string;
    title: string;
    day: string;
    time: string | null;
    location: string | null;
    place: string | null;
    attendees: string[];
    created_at: string;
  }[];
}

export class RealJobsService implements JobsBackendService {
  async choreReminders() {
    const sb = createAdminClient();
    if (!sb) return { data: null, error: "SUPABASE_SECRET_KEY isn't set" };
    const result = await sb.rpc("v2_chore_reminders");
    if (result.error) return { data: null, error: result.error.message };
    const rows = (result.data ?? []) as ReminderRow[];
    return {
      data: rows.map(({ endpoint, p256dh, auth, titles }): ChoreReminder => ({ subscription: { endpoint, p256dh, auth }, titles })),
    };
  }

  async calendarFeed({ token }: { token: string }) {
    const sb = createAdminClient();
    if (!sb) return { data: null, error: "SUPABASE_SECRET_KEY isn't set" };
    const result = await sb.rpc("v1_calendar_feed", { p_token: token });
    if (result.error) return { data: null, error: result.error.message };
    const row = result.data as FeedRow | null;
    if (!row) return { data: null };
    return {
      data: {
        togetherName: row.name,
        timeZone: row.time_zone,
        events: row.events.map(
          (e): FeedEvent => ({
            id: e.id,
            title: e.title,
            day: e.day,
            time: e.time,
            location: e.location,
            placeName: e.place,
            attendees: e.attendees,
            createdAt: e.created_at,
          })
        ),
      } satisfies CalendarFeed,
    };
  }

  async forgetPushSubscription({ endpoint }: { endpoint: string }) {
    const sb = createAdminClient();
    if (!sb) return;
    const { error } = await sb.from("push_subscriptions").delete().eq("endpoint", endpoint);
    if (error) console.error("[jobs] forgetPushSubscription", error.message);
  }
}
