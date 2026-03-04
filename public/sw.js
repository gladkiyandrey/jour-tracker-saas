self.addEventListener("push", (event) => {
  let data = { title: "Consist", body: "Open your tracker.", url: "/app" };
  try {
    data = JSON.parse(event.data?.text() || "{}") || data;
  } catch {
    // ignore parse errors
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "Consist", {
      body: data.body || "Open your tracker.",
      icon: "/icon-512.png",
      badge: "/favicon-32x32.png",
      image: data.image || "/icon-512.png",
      vibrate: [120, 40, 120],
      tag: data.tag || "consist-reminder",
      renotify: true,
      requireInteraction: false,
      actions: [
        { action: "open", title: "Open Consist" },
        { action: "close", title: "Dismiss" },
      ],
      data: { url: data.url || "/app" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  if (event.action === "close") {
    event.notification.close();
    return;
  }

  event.notification.close();
  const target = event.notification.data?.url || "/app";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(target);
      }
      return undefined;
    }),
  );
});
