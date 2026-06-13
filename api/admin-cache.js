const { Redis } = require('@upstash/redis');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { action } = req.query;
  if (action !== 'clear-realt') {
    return res.status(400).json({ error: 'action must be clear-realt' });
  }

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return res.status(500).json({ error: 'Redis not configured' });
  }

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  try {
    // Scan for all realt:* keys
    const found = [];
    let cursor = 0;
    do {
      const [next, keys] = await redis.scan(cursor, { match: 'realt:*', count: 100 });
      cursor = parseInt(next, 10);
      found.push(...keys);
    } while (cursor !== 0);

    // Also delete specific legacy keys in case scan misses them
    const extra = ['realt:csv:v1', 'realt:v3:tokenlist', 'realt:tokenlist:xdai:v2'];
    const toDelete = [...new Set([...found, ...extra])];

    let deleted = 0;
    if (toDelete.length > 0) {
      deleted = await redis.del(...toDelete);
    }

    console.log(`[admin-cache] cleared ${deleted} realt: keys:`, toDelete);
    res.json({ ok: true, deleted, keys: toDelete });
  } catch (err) {
    console.error('[admin-cache] error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
