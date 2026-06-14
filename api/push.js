// GET/POST /api/push?action=subscribe        — upsert web push subscription
// POST     /api/push?action=send             — internal send (requires Authorization: Bearer CRON_SECRET)
// GET      /api/push?action=test&user_id=XXX — send a test notification with full debug response
const webpush = require('web-push');
const { supabaseAdmin } = require('./_supabase');
const { sendPushToUser } = require('./_push');

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:contact@capitaly.fr',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;

  if (action === 'subscribe') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { subscription, user_id } = req.body || {};
    if (!subscription?.endpoint || !user_id) {
      return res.status(400).json({ error: 'Missing subscription or user_id' });
    }
    const { error } = await supabaseAdmin
      .from('push_subscriptions')
      .upsert({ user_id, subscription }, { onConflict: 'user_id,subscription->>endpoint', ignoreDuplicates: true });
    if (error) {
      console.error('[push] subscribe:', error.message);
      return res.status(500).json({ error: error.message });
    }
    return res.json({ ok: true });
  }

  if (action === 'send') {
    if (req.method !== 'POST') return res.status(405).end();
    const auth = req.headers.authorization;
    if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { user_id, title, body, url = '/' } = req.body || {};
    if (!user_id || !title || !body) return res.status(400).json({ error: 'Missing fields' });
    await sendPushToUser(user_id, title, body, url);
    return res.json({ ok: true });
  }

  if (action === 'test') {
    if (req.method !== 'GET') return res.status(405).end();
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: 'Missing user_id' });

    const vapidOk = !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
    console.log(`[push:test] user_id=${user_id} vapid_configured=${vapidOk}`);

    const { data: rows, error: dbErr } = await supabaseAdmin
      .from('push_subscriptions')
      .select('id, subscription')
      .eq('user_id', user_id);

    if (dbErr) {
      console.error('[push:test] supabase error:', dbErr.message);
      return res.json({ ok: false, subscriptionFound: false, error: `Supabase: ${dbErr.message}`, subscriptionEndpoint: null });
    }

    const subscriptionFound = !!(rows?.length);
    console.log(`[push:test] subscriptions found: ${rows?.length ?? 0}`);

    if (!subscriptionFound) {
      return res.json({ ok: false, subscriptionFound: false, error: 'No subscription found for this user_id', subscriptionEndpoint: null });
    }
    if (!vapidOk) {
      return res.json({ ok: false, subscriptionFound: true, error: 'VAPID keys not configured on server', subscriptionEndpoint: rows[0].subscription?.endpoint?.slice(0, 50) ?? null });
    }

    const payload = JSON.stringify({ title: '🎉 Capitaly - Test notification', body: 'Les notifications fonctionnent sur votre appareil !', url: '/' });
    const results = await Promise.all(rows.map(async ({ id, subscription }) => {
      const endpoint = subscription?.endpoint ?? '';
      try {
        await webpush.sendNotification(subscription, payload);
        console.log(`[push:test] sent OK → ${endpoint.slice(0, 60)}`);
        return { id, ok: true, endpoint };
      } catch (err) {
        console.error(`[push:test] webpush error (status=${err.statusCode}): ${err.message} → ${endpoint.slice(0, 60)}`);
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabaseAdmin.from('push_subscriptions').delete().eq('id', id);
          console.log(`[push:test] deleted stale subscription id=${id}`);
        }
        return { id, ok: false, error: `HTTP ${err.statusCode}: ${err.message}`, endpoint };
      }
    }));

    const allOk = results.every(r => r.ok);
    const firstError = results.find(r => !r.ok)?.error ?? null;
    const firstEndpoint = results[0]?.endpoint?.slice(0, 50) ?? null;

    return res.json({ ok: allOk, subscriptionFound: true, error: firstError, subscriptionEndpoint: firstEndpoint, results });
  }

  return res.status(400).json({ error: 'action must be subscribe, send or test' });
};
