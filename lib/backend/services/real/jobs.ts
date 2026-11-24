import "server-only";
import type { FilesCleanup, JobsBackendService } from "@/lib/backend/interfaces/jobs";
import { deleteObjects, listObjects } from "@/lib/backend/services/real/file-store";
import { fileIdOf, orphanedObjects } from "@/lib/files/storage";
import type { CalendarFeed, ChoreReminder, FeedEvent } from "@/lib/models";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAnonClient } from "@/lib/supabase/anon";

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

  async cleanUpFiles(): Promise<{ data: FilesCleanup | null; error?: string }> {
    const sb = createAdminClient();
    if (!sb) return { data: null, error: "SUPABASE_SECRET_KEY isn't set" };
    try {
      // 1. uploads nobody finished or aborted: the rows go first, then their objects
      const swept = await sb.rpc("v1_sweep_stale_uploads");
      if (swept.error) return { data: null, error: swept.error.message };
      const stalePaths = (swept.data as string[] | null) ?? [];
      await deleteObjects(stalePaths);
      const staleUploads = new Set(stalePaths.map(fileIdOf)).size;

      // 2. objects with no row (an abort whose delete failed, a stray): a page of the bucket at a time
      let orphans = 0;
      const now = new Date();
      for await (const page of listObjects()) {
        const ids = [...new Set(page.map((o) => fileIdOf(o.path)).filter((id): id is string => id !== null))];
        const known = new Set<string>();
        for (let i = 0; i < ids.length; i += 200) {
          const rows = await sb.from("files").select("id").in("id", ids.slice(i, i + 200));
          if (rows.error) return { data: null, error: rows.error.message };
          for (const r of (rows.data ?? []) as { id: string }[]) known.add(r.id);
        }
        const gone = orphanedObjects(page, known, now);
        await deleteObjects(gone);
        orphans += gone.length;
      }
      return { data: { staleUploads, objects: stalePaths.length + orphans } };
    } catch (e) {
      return { data: null, error: e instanceof Error ? e.message : "The files clean-up failed." };
    }
  }

  async calendarFeed({ token }: { token: string }) {
    // the token is the lock, so the publishable key will do: no secret key needed
    const result = await createAnonClient().rpc("v1_calendar_feed", { p_token: token });
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
