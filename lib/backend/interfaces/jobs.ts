import type { CalendarFeed, ChoreReminder } from "@/lib/models";

/**
 * Work the server does itself rather than for a signed-in person: scheduled jobs (app/api/cron) and the calendar
 * feed that calendar apps fetch (app/api/calendar). The real implementation uses the Supabase secret key, so it can
 * see every Together.
 */
export interface JobsBackendService {
  /** every device whose owner has chores due today or overdue (in their Together's time zone) */
  choreReminders(): Promise<{ data: ChoreReminder[] | null; error?: string }>;
  /** the push service said this device is gone (uninstalled, permission revoked) */
  forgetPushSubscription(params: { endpoint: string }): Promise<void>;
  /** what a calendar feed token opens; null data, without an error, when it opens nothing (unknown, reset, or left) */
  calendarFeed(params: { token: string }): Promise<{ data: CalendarFeed | null; error?: string }>;
}
