const webpush = require('web-push');
const { supabaseAdmin } = require('./_supabase');

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:contact@capitaly.fr',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// Send a push notification to all subscriptions of a given user.
// Automatically removes expired (410 Gone) subscriptions.
async function sendPushToUser(userId, title, body, url = '/') {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;
  const { data: rows } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, subscription')
    .eq('user_id', userId);
  if (!rows?.length) return;

  const payload = JSON.stringify({ title, body, url });
  await Promise.allSettled(rows.map(async ({ id, subscription }) => {
    try {
      await webpush.sendNotification(subscription, payload);
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await supabaseAdmin.from('push_subscriptions').delete().eq('id', id);
      }
    }
  }));
}

module.exports = { sendPushToUser };
