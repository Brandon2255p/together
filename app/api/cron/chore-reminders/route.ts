// The daily chore reminder: pushes "due today" to everyone's devices. Called by a scheduler (Vercel Cron, or a
// Coolify scheduled task) with `Authorization: Bearer $CRON_SECRET`. Public in lib/supabase/proxy.ts; the secret
// is the lock.
import { jobsBackend } from "@/lib/backend/jobs";
import { choreReminderMessage } from "@/lib/push/message";
import { pushConfigured, sendPush } from "@/lib/push/send";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!pushConfigured()) return Response.json({ error: "VAPID keys aren't set" }, { status: 503 });

  const { data, error } = await jobsBackend.choreReminders();
  if (!data) return Response.json({ error }, { status: 500 });

  const counts = { sent: 0, gone: 0, failed: 0 };
  await Promise.all(
    data.map(async ({ subscription, titles }) => {
      const result = await sendPush(subscription, choreReminderMessage(titles));
      counts[result]++;
      if (result === "gone") await jobsBackend.forgetPushSubscription({ endpoint: subscription.endpoint });
    }),
  );
  console.log("[cron] chore reminders", counts);
  return Response.json(counts);
}
