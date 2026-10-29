// MailBakes Personal service worker: shows phone notifications and opens
// the right page when one is tapped. Nothing is cached.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "MailBakes", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "MailBakes";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      tag: data.tag || undefined,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/notifications" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/notifications";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const same = windows.find((client) => client.url.startsWith(self.location.origin));
      if (same && url.startsWith(self.location.origin)) {
        same.navigate(url);
        return same.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
