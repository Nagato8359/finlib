// POST /api/push-subscribe
// Body: { subscription: PushSubscriptionJSON, user_id: string }
// Upserts the push subscription for this user.
const { supabaseAdmin } = require('./_supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { subscription, user_id } = req.body || {};
  if (!subscription?.endpoint || !user_id) {
    return res.status(400).json({ error: 'Missing subscription or user_id' });
  }

  const { error } = await supabaseAdmin
    .from('push_subscriptions')
    .upsert({ user_id, subscription }, { onConflict: 'user_id,subscription->>endpoint', ignoreDuplicates: true });

  if (error) {
    console.error('[push-subscribe]', error.message);
    return res.status(500).json({ error: error.message });
  }
  return res.json({ ok: true });
};
