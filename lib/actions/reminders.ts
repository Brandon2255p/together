"use server";

import { serverBackend } from "@/lib/backend/server";
import type { PushSubscriptionKeys } from "@/lib/models";

const B64URL = /^[A-Za-z0-9_-]+=*$/;

export async function turnOnReminders(subscription: PushSubscriptionKeys) {
  const { endpoint, p256dh, auth } = subscription;
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000) return { success: false, error: "That device can't get reminders." };
  if (!B64URL.test(p256dh) || p256dh.length > 200 || !B64URL.test(auth) || auth.length > 100) {
    return { success: false, error: "That device can't get reminders." };
  }
  return serverBackend.savePushSubscription({ endpoint, p256dh, auth });
}

export async function turnOffReminders(endpoint: string) {
  return serverBackend.deletePushSubscription({ endpoint });
}
