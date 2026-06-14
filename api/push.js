// GET/POST /api/push?action=subscribe        — upsert web push subscription
// POST     /api/push?action=send             — internal send (requires Authorization: Bearer CRON_SECRET)
// GET      /api/push?action=test&user_id=XXX — send a test notification (requires Authorization: Bearer CRON_SECRET)
const { supabaseAdmin } = require('./_supabase');
const { sendPushToUser } = require('./_push');

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
    const auth = req.headers.authorization;
    if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: 'Missing user_id' });
    await sendPushToUser(
      user_id,
      '🎉 Capitaly - Test notification',
      'Les notifications fonctionnent sur votre appareil !',
      '/'
    );
    return res.json({ ok: true });
  }

  return res.status(400).json({ error: 'action must be subscribe, send or test' });
};
