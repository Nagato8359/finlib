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

// ── Web Push VAPID subscription ───────────────────────────────────────────────
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export const registerPush = async (userId) => {
  console.log('1. SW support:', 'serviceWorker' in navigator);
  console.log('2. PushManager support:', 'PushManager' in window);
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  console.log('3. VAPID KEY:', process.env.REACT_APP_VAPID_PUBLIC_KEY?.slice(0, 10));
  const publicKey = process.env.REACT_APP_VAPID_PUBLIC_KEY;
  if (!publicKey) return;

  try {
    const reg = await navigator.serviceWorker.ready;
    const permission = await Notification.requestPermission();
    console.log('4. Permission:', permission);
    if (permission !== 'granted') return;

    const existing = await reg.pushManager.getSubscription();
    const sub = existing || await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
    console.log('5. Subscription:', sub);

    const apiRes = await fetch('/api/push?action=subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON(), user_id: userId }),
    });
    const apiData = await apiRes.json().catch(() => ({}));
    console.log('6. API response:', apiRes.status, apiData);
  } catch (err) {
    console.error('[push] registerPush error:', err);
  }
};

// ── iOS detection ──────────────────────────────────────────────────────────────
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

// ── Daily 20h notification ────────────────────────────────────────────────────
const DAILY_KEY = 'capitaly_daily_notif_date';
const todayStr  = () => new Date().toISOString().slice(0, 10);

export const checkAndSendDailyNotif = async ({ transactions = [], invTotal = 0 } = {}, iosFallback = null) => {
  if (!isNotifEnabled()) return;
  const today = todayStr();
  if (localStorage.getItem(DAILY_KEY) === today) return;

  const now = new Date();
  const h = now.getHours(), m = now.getMinutes();
  if (h !== 20 || m > 30) return;

  const todayTx = transactions.filter(t => t.date === today);
  const todayBalance = todayTx.reduce((s, t) => s + (t.amount || 0), 0);

  let body;
  if (todayBalance > 50)       body = `Votre patrimoine a progressé de +${Math.round(todayBalance)}€ aujourd'hui 🚀`;
  else if (todayBalance < -50) body = `Recul de ${Math.round(todayBalance)}€ aujourd'hui 📉`;
  else                         body = `Journée neutre. Patrimoine total : ${Math.round(invTotal).toLocaleString('fr-FR')}€ 📊`;

  localStorage.setItem(DAILY_KEY, today);

  if (isIOS() && iosFallback) { iosFallback('📊 Capitaly — Performance du jour\n' + body); return; }
  await notify('📊 Capitaly — Performance du jour', body);
};

// ── Reminder notification if no data entered for N days ──────────────────────
const REMINDER_KEY    = 'capitaly_last_reminder';
const MSGS_3 = [
  "📝 Hé ! Vous n'avez rien saisi depuis 3 jours. Gardez votre tableau de bord à jour !",
  "💡 Quelques dépenses à enregistrer ? Restez focus sur vos finances !",
  "📊 Votre patrimoine vous attend. Ajoutez vos dernières transactions !",
];
const MSGS_7 = [
  "⚠️ 7 jours sans mise à jour ! Votre suivi financier en souffre. Revenez sur Capitaly !",
  "🎯 L'indépendance financière se construit au quotidien. Reprenez le contrôle !",
  "💪 Ne lâchez pas ! Mettez à jour Capitaly et restez sur la bonne voie.",
];

export const checkReminderNotif = async (transactions = [], iosFallback = null) => {
  if (!isNotifEnabled()) return;
  const today = todayStr();
  if (localStorage.getItem(REMINDER_KEY) === today) return;

  const lastDate   = [...transactions].map(t => t.date).sort().reverse()[0];
  const daysSince  = Math.floor((new Date(today) - new Date(lastDate)) / 86400000);
  if (daysSince < 3) return;

  const pool = daysSince >= 7 ? MSGS_7 : MSGS_3;
  const msg  = pool[Math.floor(Math.random() * pool.length)];
  const title = daysSince >= 7 ? '⚠️ Capitaly — Rappel urgent' : '📝 Capitaly — Rappel';

  localStorage.setItem(REMINDER_KEY, today);

  if (isIOS() && iosFallback) { iosFallback(title + '\n' + msg); return; }
  await notify(title, msg);
};
