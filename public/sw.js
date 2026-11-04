// Together's service worker: shows chore reminders (Web Push) and opens the app where they point.
// Registered from app/(app)/_lib/pwa.ts. Kept plain JS so it's served as-is at /sw.js.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "Together", body: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Together", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/badge-96.png",
      // one reminder at a time: today's replaces yesterday's
      tag: "chores",
      renotify: true,
      data: { url: data.url || "/home" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/home", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) {
        await open.navigate(url).catch(() => undefined);
        return open.focus();
      }
      return self.clients.openWindow(url);
    })(),
  );
});
