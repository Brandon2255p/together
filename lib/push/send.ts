import "server-only";
import webpush from "web-push";
import type { PushSubscriptionKeys } from "@/lib/models";

/**
 * Web Push with VAPID. Needs VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT (a mailto: or https:
 * address push services can contact). Make a key pair with `pnpm dlx web-push generate-vapid-keys`.
 */
let configured: boolean | null = null;
function configure(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  configured = Boolean(publicKey && privateKey && subject);
  if (configured) webpush.setVapidDetails(subject!, publicKey!, privateKey!);
  else console.warn("[push] VAPID keys aren't set: reminders are off");
  return configured;
}

export const pushConfigured = () => configure();

export type PushResult = "sent" | "gone" | "failed";

/** "gone" means the device unsubscribed or the app was removed: forget it */
export async function sendPush(subscription: PushSubscriptionKeys, payload: { title: string; body: string; url: string }): Promise<PushResult> {
  if (!configure()) return "failed";
  try {
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      JSON.stringify(payload),
      { TTL: 6 * 60 * 60, urgency: "normal" },
    );
    return "sent";
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return "gone";
    console.error("[push]", status ?? "", (error as Error).message);
    return "failed";
  }
}
