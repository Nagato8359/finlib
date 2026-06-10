export const requestNotifPermission = async () => {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const perm = await Notification.requestPermission();
  return perm === 'granted';
};

export const notify = async (title, body) => {
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
