self.addEventListener('install', (e) => {
  console.log('[SW] installed');
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  console.log('[SW] activated');
  e.waitUntil(clients.claim());
});

self.addEventListener('push', (e) => {
  if (!e.data) return;
  const data = e.data.json();
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/logo192.png',
      badge: '/logo192.png',
      data: { url: data.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then((list) => {
      for (const client of list) {
        if (client.url === e.notification.data.url && 'focus' in client)
          return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(e.notification.data.url);
    })
  );
});
