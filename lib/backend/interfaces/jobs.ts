import type { CalendarFeed, ChoreReminder } from "@/lib/models";

/** what the daily files clean-up removed */
export interface FilesCleanup {
  /** unfinished upload rows deleted */
  staleUploads: number;
  /** objects deleted: those rows' objects, and objects with no row */
  objects: number;
}

/**
 * Work the server does itself rather than for a signed-in person: scheduled jobs (app/api/cron) and the calendar
 * feed that calendar apps fetch (app/api/calendar). The real jobs use the Supabase secret key, so they can see every
 * Together; the feed needs only the publishable key, because its token is the lock.
 */
export interface JobsBackendService {
  /** every device whose owner has chores due today or overdue (in their Together's time zone) */
  choreReminders(): Promise<{ data: ChoreReminder[] | null; error?: string }>;
  /** the push service said this device is gone (uninstalled, permission revoked) */
  forgetPushSubscription(params: { endpoint: string }): Promise<void>;
  /**
   * Keeps the database and the files bucket in step: deletes uploads that never finished (rows still uploading an hour
   * on, with their objects), then any object with no row.
   */
  cleanUpFiles(): Promise<{ data: FilesCleanup | null; error?: string }>;
  /** what a calendar feed token opens; null data, without an error, when it opens nothing (unknown, reset, or left) */
  calendarFeed(params: { token: string }): Promise<{ data: CalendarFeed | null; error?: string }>;
}
