import type { ChoreReminder } from "@/lib/models";

/**
 * Scheduled jobs, run by the server itself rather than a signed-in person (app/api/cron). The real implementation
 * uses the Supabase secret key, so it can see every Together.
 */
export interface JobsBackendService {
  /** every device whose owner has chores due today or overdue (in their Together's time zone) */
  choreReminders(): Promise<{ data: ChoreReminder[] | null; error?: string }>;
  /** the push service said this device is gone (uninstalled, permission revoked) */
  forgetPushSubscription(params: { endpoint: string }): Promise<void>;
}
