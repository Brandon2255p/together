import "server-only";
import type { JobsBackendService } from "@/lib/backend/interfaces/jobs";
import type { ChoreReminder } from "@/lib/models";
import { createAdminClient } from "@/lib/supabase/admin";

interface ReminderRow {
  endpoint: string;
  p256dh: string;
  auth: string;
  titles: string[];
}

export class RealJobsService implements JobsBackendService {
  async choreReminders() {
    const sb = createAdminClient();
    if (!sb) return { data: null, error: "SUPABASE_SECRET_KEY isn't set" };
    const result = await sb.rpc("v1_chore_reminders");
    if (result.error) return { data: null, error: result.error.message };
    const rows = (result.data ?? []) as ReminderRow[];
    return {
      data: rows.map(({ endpoint, p256dh, auth, titles }): ChoreReminder => ({ subscription: { endpoint, p256dh, auth }, titles })),
    };
  }

  async forgetPushSubscription({ endpoint }: { endpoint: string }) {
    const sb = createAdminClient();
    if (!sb) return;
    const { error } = await sb.from("push_subscriptions").delete().eq("endpoint", endpoint);
    if (error) console.error("[jobs] forgetPushSubscription", error.message);
  }
}
