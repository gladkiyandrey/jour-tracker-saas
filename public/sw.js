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
      icon: "/icon-192.png",
      badge: "/favicon-32x32.png",
      data: { url: data.url || "/app" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
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
