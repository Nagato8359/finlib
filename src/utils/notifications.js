const SENT_KEY = 'sent_notifications';

const isNotifEnabled = () => localStorage.getItem('ct_notif') !== '0';

const send = async (title, body) => {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.ready.catch(() => null) : null;
    if (reg) {
      reg.showNotification(title, { body, icon: '/logo192.png', badge: '/logo192.png' });
    } else {
      new Notification(title, { body, icon: '/logo192.png' });
    }
  } catch {}
};

export const requestNotifPermission = async () => {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const perm = await Notification.requestPermission();
  return perm === 'granted';
};

// One-shot notification: sends only once per unique id, persisted in localStorage.
export const notifyOnce = async (id, title, body) => {
  if (!isNotifEnabled()) return;
  const sent = JSON.parse(localStorage.getItem(SENT_KEY) || '[]');
  if (sent.includes(id)) return;
  localStorage.setItem(SENT_KEY, JSON.stringify([...sent, id]));
  await send(title, body);
};

// Generic notification (no dedup, but respects the user preference toggle).
export const notify = async (title, body) => {
  if (!isNotifEnabled()) return;
  await send(title, body);
};

// Call on logout so the next session (or a different user) starts clean.
export const clearSentNotifications = () => localStorage.removeItem(SENT_KEY);
