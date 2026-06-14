// POST /api/push-send (internal — called by trusted services only)
// Body: { user_id, title, body, url? }
// Requires CRON_SECRET in Authorization header.
const { sendPushToUser } = require('./_push');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const auth = req.headers.authorization;
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { user_id, title, body, url = '/' } = req.body || {};
  if (!user_id || !title || !body) return res.status(400).json({ error: 'Missing fields' });

  await sendPushToUser(user_id, title, body, url);
  return res.json({ ok: true });
};
