"use client";

// Browser-side PWA plumbing for view-models: the service worker, the install prompt and push subscriptions.

/** Chromium's install prompt (not in TypeScript's DOM types) */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredInstall: BeforeInstallPromptEvent | null = null;
const installListeners = new Set<() => void>();
let listening = false;

/** registers /sw.js and starts catching the install prompt (it fires once, early, so the app shell does this) */
export function setUpPwa() {
  if (typeof window === "undefined") return;
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((error: unknown) => {
      console.warn("[pwa] service worker", error);
    });
  }
  if (listening) return;
  listening = true;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstall = event as BeforeInstallPromptEvent;
    installListeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    deferredInstall = null;
    installListeners.forEach((l) => l());
  });
}

export function onInstallPromptChange(listener: () => void) {
  installListeners.add(listener);
  return () => void installListeners.delete(listener);
}

export const canPromptInstall = () => deferredInstall !== null;

export async function promptInstall(): Promise<boolean> {
  const event = deferredInstall;
  if (!event) return false;
  deferredInstall = null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  installListeners.forEach((l) => l());
  return outcome === "accepted";
}

export const isInstalled = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

// ---- Push ----

export type PushSupport = "ready" | "unsupported" | "needs-install" | "denied" | "no-keys";

/** `vapidPublicKey` comes from the server (VAPID_PUBLIC_KEY), null when push isn't set up there */
export function pushSupport(vapidPublicKey: string | null): PushSupport {
  if (!vapidPublicKey) return "no-keys";
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  // iOS only offers push to apps added to the home screen
  if (!supported) return isIos() && !isInstalled() ? "needs-install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  return "ready";
}

export async function currentPushSubscription(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator)) return null;
  const registration = await navigator.serviceWorker.getRegistration("/");
  return (await registration?.pushManager.getSubscription()) ?? null;
}

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

/** asks for permission (needs a tap) and subscribes this device; null when the person said no */
export async function subscribeToPush(vapidPublicKey: string): Promise<{ endpoint: string; p256dh: string; auth: string } | null> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;
  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) }));
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return null;
  return { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth };
}
