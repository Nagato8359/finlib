const { Redis } = require('@upstash/redis');

let redis = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

async function getCached(key) {
  if (!redis) return null;
  try {
    return await redis.get(key);
  } catch {
    return null;
  }
}

async function setCached(key, value, ttl) {
  if (!redis) return;
  try {
    await redis.set(key, value, { ex: ttl });
  } catch {}
}

async function delCached(key) {
  if (!redis) return;
  try {
    await redis.del(key);
  } catch {}
}

module.exports = { getCached, setCached, delCached };
